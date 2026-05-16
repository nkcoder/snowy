package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type SchemaItem struct {
	Name string `json:"name"`
}

type TableItem struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
	Type   string `json:"type"` // BASE TABLE or VIEW
}

type ColumnItem struct {
	Name       string `json:"name"`
	DataType   string `json:"dataType"`
	IsNullable string `json:"isNullable"`
	KeyType    string `json:"keyType"` // "pk" | "fk" | ""
}

type QueryResult struct {
	Columns    []string        `json:"columns"`
	Rows       [][]interface{} `json:"rows"`
	DurationMs int64           `json:"durationMs"`
	RowCount   int             `json:"rowCount"`
}

// CompletionEntry represents a single autocomplete item (schema, table, view, or column).
type CompletionEntry struct {
	Kind     string `json:"kind"`     // "schema" | "table" | "view" | "column"
	Schema   string `json:"schema"`
	Table    string `json:"table"`    // empty for schema-kind entries
	Name     string `json:"name"`
	DataType string `json:"dataType"` // non-empty for column-kind entries
	KeyType  string `json:"keyType"`  // "pk" | "fk" | "" — only for column-kind entries
}

// CompletionSet is the full set of DB-aware completions for a datasource.
type CompletionSet struct {
	Entries []CompletionEntry `json:"entries"`
}

type DbService struct {
	app             *App
	completionCache sync.Map // dsId → *CompletionSet
}

func NewDbService(app *App) *DbService {
	return &DbService{app: app}
}

func (s *DbService) getConnectionTimeout(dsId string, timeout time.Duration) (*pgx.Conn, context.Context, context.CancelFunc, error) {
	config, err := s.app.configManager.LoadConfig()
	if err != nil {
		return nil, nil, nil, err
	}

	var ds *Datasource
	for _, d := range config.Datasources {
		if d.ID == dsId {
			ds = &d
			break
		}
	}

	if ds == nil {
		return nil, nil, nil, fmt.Errorf("datasource %s not found", dsId)
	}

	sslMode := ds.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	connConfig, err := pgx.ParseConfig(fmt.Sprintf("host=%s port=%d dbname=%s user=%s sslmode=%s",
		ds.Host, ds.Port, ds.Database, ds.Username, sslMode))
	if err != nil {
		cancel()
		return nil, nil, nil, err
	}
	connConfig.Password = ds.Password
	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		cancel()
		return nil, nil, nil, err
	}

	return conn, ctx, cancel, nil
}

func (s *DbService) getConnection(dsId string) (*pgx.Conn, context.Context, context.CancelFunc, error) {
	return s.getConnectionTimeout(dsId, 10*time.Second)
}

func (s *DbService) ListSchemas(dsId string) ([]SchemaItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schemas := make([]SchemaItem, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		schemas = append(schemas, SchemaItem{Name: name})
	}

	return schemas, nil
}

func (s *DbService) ListTables(dsId string, schema string) ([]TableItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	rows, err := conn.Query(ctx, "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1", schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]TableItem, 0)
	for rows.Next() {
		var name, tableType string
		if err := rows.Scan(&name, &tableType); err != nil {
			return nil, err
		}
		tables = append(tables, TableItem{Schema: schema, Name: name, Type: tableType})
	}

	return tables, nil
}

func (s *DbService) ListColumns(dsId string, schema, table string) ([]ColumnItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	const colSQL = `
		SELECT
			c.column_name,
			c.data_type,
			c.is_nullable,
			CASE
				WHEN EXISTS (
					SELECT 1 FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage ku
						ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
					WHERE tc.table_schema = $1 AND tc.table_name = $2
						AND tc.constraint_type = 'PRIMARY KEY' AND ku.column_name = c.column_name
				) THEN 'pk'
				WHEN EXISTS (
					SELECT 1 FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage ku
						ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
					WHERE tc.table_schema = $1 AND tc.table_name = $2
						AND tc.constraint_type = 'FOREIGN KEY' AND ku.column_name = c.column_name
				) THEN 'fk'
				ELSE ''
			END AS key_type
		FROM information_schema.columns c
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position`

	rows, err := conn.Query(ctx, colSQL, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]ColumnItem, 0)
	for rows.Next() {
		var name, dataType, isNullable, keyType string
		if err := rows.Scan(&name, &dataType, &isNullable, &keyType); err != nil {
			return nil, err
		}
		columns = append(columns, ColumnItem{Name: name, DataType: dataType, IsNullable: isNullable, KeyType: keyType})
	}

	return columns, nil
}

// GetCompletions returns all schemas, tables, views and columns for a datasource.
// Results are cached in-memory per dsId (cache is invalidated on process restart).
// TableKeyItem represents a primary key constraint on a table.
type TableKeyItem struct {
	Name    string `json:"name"`
	Columns string `json:"columns"`
}

// ForeignKeyItem represents a foreign key constraint on a table.
type ForeignKeyItem struct {
	Name       string `json:"name"`
	Columns    string `json:"columns"`
	RefSchema  string `json:"refSchema"`
	RefTable   string `json:"refTable"`
	RefColumns string `json:"refColumns"`
}

// IndexItem represents an index on a table (primary key indexes excluded).
type IndexItem struct {
	Name     string `json:"name"`
	IsUnique bool   `json:"isUnique"`
	Columns  string `json:"columns"`
}

// CheckItem represents a check constraint on a table.
type CheckItem struct {
	Name       string `json:"name"`
	Definition string `json:"definition"`
}

// TableMetadata holds all introspected metadata for one table or view.
type TableMetadata struct {
	Name        string           `json:"name"`
	Type        string           `json:"type"` // BASE TABLE | VIEW
	Columns     []ColumnItem     `json:"columns"`
	Keys        []TableKeyItem   `json:"keys"`
	ForeignKeys []ForeignKeyItem `json:"foreignKeys"`
	Indexes     []IndexItem      `json:"indexes"`
	Checks      []CheckItem      `json:"checks"`
}

// SchemaMetadata holds all tables/views for one schema.
type SchemaMetadata struct {
	Name   string          `json:"name"`
	Tables []TableMetadata `json:"tables"`
}

// DatabaseMetadata is the full introspection result for a datasource.
type DatabaseMetadata struct {
	Schemas   []SchemaMetadata `json:"schemas"`
	FetchedAt time.Time        `json:"fetchedAt"`
}

func (s *DbService) ListTableKeys(dsId, schema, table string) ([]TableKeyItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	const q = `
		SELECT tc.constraint_name,
		       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS cols
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		     ON tc.constraint_name = kcu.constraint_name
		     AND tc.table_schema   = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
		  AND tc.table_schema = $1 AND tc.table_name = $2
		GROUP BY tc.constraint_name`

	rows, err := conn.Query(ctx, q, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TableKeyItem, 0)
	for rows.Next() {
		var it TableKeyItem
		if err := rows.Scan(&it.Name, &it.Columns); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

func (s *DbService) ListTableForeignKeys(dsId, schema, table string) ([]ForeignKeyItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	const q = `
		SELECT tc.constraint_name,
		       string_agg(DISTINCT kcu.column_name, ', ' ORDER BY kcu.column_name) AS cols,
		       MIN(ccu.table_schema) AS ref_schema,
		       MIN(ccu.table_name)   AS ref_table,
		       string_agg(DISTINCT ccu.column_name, ', ' ORDER BY ccu.column_name) AS ref_cols
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		     ON tc.constraint_name = kcu.constraint_name
		     AND tc.table_schema   = kcu.table_schema
		JOIN information_schema.constraint_column_usage ccu
		     ON tc.constraint_name = ccu.constraint_name
		     AND tc.table_schema   = ccu.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = $1 AND tc.table_name = $2
		GROUP BY tc.constraint_name`

	rows, err := conn.Query(ctx, q, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ForeignKeyItem, 0)
	for rows.Next() {
		var it ForeignKeyItem
		if err := rows.Scan(&it.Name, &it.Columns, &it.RefSchema, &it.RefTable, &it.RefColumns); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

func (s *DbService) ListTableIndexes(dsId, schema, table string) ([]IndexItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	const q = `
		SELECT i.relname,
		       ix.indisunique,
		       string_agg(a.attname, ', ' ORDER BY k.n) AS cols
		FROM pg_class t
		JOIN pg_index     ix ON ix.indrelid = t.oid
		JOIN pg_class      i ON i.oid = ix.indexrelid
		JOIN pg_namespace  n ON n.oid = t.relnamespace
		JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n) ON true
		JOIN pg_attribute  a ON a.attrelid = t.oid AND a.attnum = k.attnum
		WHERE n.nspname = $1 AND t.relname = $2
		  AND NOT ix.indisprimary
		GROUP BY i.relname, ix.indisunique
		ORDER BY i.relname`

	rows, err := conn.Query(ctx, q, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]IndexItem, 0)
	for rows.Next() {
		var it IndexItem
		if err := rows.Scan(&it.Name, &it.IsUnique, &it.Columns); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

func (s *DbService) ListTableChecks(dsId, schema, table string) ([]CheckItem, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	const q = `
		SELECT cc.constraint_name, cc.check_clause
		FROM information_schema.check_constraints cc
		JOIN information_schema.table_constraints tc
		     ON cc.constraint_name  = tc.constraint_name
		     AND cc.constraint_schema = tc.constraint_schema
		WHERE tc.constraint_type = 'CHECK'
		  AND tc.table_schema = $1 AND tc.table_name = $2
		  AND cc.check_clause NOT LIKE '%IS NOT NULL%'
		ORDER BY cc.constraint_name`

	rows, err := conn.Query(ctx, q, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CheckItem, 0)
	for rows.Next() {
		var it CheckItem
		if err := rows.Scan(&it.Name, &it.Definition); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

func (s *DbService) GetCompletions(dsId string) (*CompletionSet, error) {
	if cached, ok := s.completionCache.Load(dsId); ok {
		return cached.(*CompletionSet), nil
	}

	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	var entries []CompletionEntry

	// Schemas
	schemaRows, err := conn.Query(ctx,
		`SELECT schema_name FROM information_schema.schemata
		 WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 ORDER BY schema_name`)
	if err != nil {
		return nil, fmt.Errorf("list schemas: %w", err)
	}
	for schemaRows.Next() {
		var name string
		if err := schemaRows.Scan(&name); err != nil {
			schemaRows.Close()
			return nil, err
		}
		entries = append(entries, CompletionEntry{Kind: "schema", Name: name})
	}
	schemaRows.Close()

	// Tables and views
	tableRows, err := conn.Query(ctx,
		`SELECT table_schema, table_name, table_type FROM information_schema.tables
		 WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 ORDER BY table_schema, table_name`)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	for tableRows.Next() {
		var schema, name, tableType string
		if err := tableRows.Scan(&schema, &name, &tableType); err != nil {
			tableRows.Close()
			return nil, err
		}
		kind := "table"
		if tableType == "VIEW" {
			kind = "view"
		}
		entries = append(entries, CompletionEntry{Kind: kind, Schema: schema, Name: name})
	}
	tableRows.Close()

	// Columns with PK/FK classification
	colRows, err := conn.Query(ctx,
		`SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
			CASE
				WHEN EXISTS (
					SELECT 1 FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage ku
						ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
					WHERE tc.table_schema = c.table_schema AND tc.table_name = c.table_name
						AND tc.constraint_type = 'PRIMARY KEY' AND ku.column_name = c.column_name
				) THEN 'pk'
				WHEN EXISTS (
					SELECT 1 FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage ku
						ON tc.constraint_name = ku.constraint_name AND tc.table_schema = ku.table_schema
					WHERE tc.table_schema = c.table_schema AND tc.table_name = c.table_name
						AND tc.constraint_type = 'FOREIGN KEY' AND ku.column_name = c.column_name
				) THEN 'fk'
				ELSE ''
			END AS key_type
		 FROM information_schema.columns c
		 WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 ORDER BY c.table_schema, c.table_name, c.ordinal_position`)
	if err != nil {
		return nil, fmt.Errorf("list columns: %w", err)
	}
	for colRows.Next() {
		var schema, table, name, dataType, keyType string
		if err := colRows.Scan(&schema, &table, &name, &dataType, &keyType); err != nil {
			colRows.Close()
			return nil, err
		}
		entries = append(entries, CompletionEntry{Kind: "column", Schema: schema, Table: table, Name: name, DataType: dataType, KeyType: keyType})
	}
	colRows.Close()

	result := &CompletionSet{Entries: entries}
	s.completionCache.Store(dsId, result)
	return result, nil
}

// metadataCachePath returns ~/.snowy/cache/<dsId>.json, creating the dir if needed.
func metadataCachePath(dsId string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".snowy", "cache")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(dir, dsId+".json"), nil
}

// LoadCachedMetadata reads a previously saved DatabaseMetadata from disk.
// Returns an empty DatabaseMetadata (no schemas) if the file does not exist.
func (s *DbService) LoadCachedMetadata(dsId string) (DatabaseMetadata, error) {
	path, err := metadataCachePath(dsId)
	if err != nil {
		return DatabaseMetadata{Schemas: make([]SchemaMetadata, 0)}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return DatabaseMetadata{Schemas: make([]SchemaMetadata, 0)}, nil
	}
	var meta DatabaseMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return DatabaseMetadata{Schemas: make([]SchemaMetadata, 0)}, nil
	}
	if meta.Schemas == nil {
		meta.Schemas = make([]SchemaMetadata, 0)
	}
	return meta, nil
}

// SaveMetadataCache writes metadata to disk. Errors are non-fatal.
func (s *DbService) SaveMetadataCache(dsId string, meta DatabaseMetadata) error {
	path, err := metadataCachePath(dsId)
	if err != nil {
		return err
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// FetchDatabaseMetadata opens a single connection and fetches schemas, tables,
// columns, keys, foreign keys, indexes, and checks in 7 sequential queries.
func (s *DbService) FetchDatabaseMetadata(dsId string) (DatabaseMetadata, error) {
	conn, ctx, cancel, err := s.getConnectionTimeout(dsId, 60*time.Second)
	if err != nil {
		return DatabaseMetadata{}, err
	}
	defer conn.Close(ctx)
	defer cancel()

	type tableKey struct{ schema, table string }
	tableMap := make(map[tableKey]*TableMetadata)
	schemaOrder := make([]string, 0)
	seenSchemas := make(map[string]bool)
	tableOrder := make(map[string][]string) // schema → ordered table names

	// ── 1. Schemas ────────────────────────────────────────────────────────────
	rows, err := conn.Query(ctx,
		`SELECT schema_name FROM information_schema.schemata
		 WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 ORDER BY schema_name`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("schemas: %w", err)
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		schemaOrder = append(schemaOrder, name)
		seenSchemas[name] = true
	}
	rows.Close()

	// ── 2. Tables ─────────────────────────────────────────────────────────────
	rows, err = conn.Query(ctx,
		`SELECT table_schema, table_name, table_type
		 FROM information_schema.tables
		 WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 ORDER BY table_schema, table_name`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("tables: %w", err)
	}
	for rows.Next() {
		var schema, name, tableType string
		if err := rows.Scan(&schema, &name, &tableType); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		key := tableKey{schema, name}
		tableMap[key] = &TableMetadata{
			Name:        name,
			Type:        tableType,
			Columns:     make([]ColumnItem, 0),
			Keys:        make([]TableKeyItem, 0),
			ForeignKeys: make([]ForeignKeyItem, 0),
			Indexes:     make([]IndexItem, 0),
			Checks:      make([]CheckItem, 0),
		}
		tableOrder[schema] = append(tableOrder[schema], name)
		if !seenSchemas[schema] {
			schemaOrder = append(schemaOrder, schema)
			seenSchemas[schema] = true
		}
	}
	rows.Close()

	// ── 3. Columns (CTE-based pk/fk detection) ────────────────────────────────
	const colSQL = `
		WITH pk_cols AS (
			SELECT tc.table_schema, tc.table_name, kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
			WHERE tc.constraint_type = 'PRIMARY KEY'
			  AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		),
		fk_cols AS (
			SELECT tc.table_schema, tc.table_name, kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
			  AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		)
		SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable,
			CASE WHEN pk.column_name IS NOT NULL THEN 'pk'
				 WHEN fk.column_name IS NOT NULL THEN 'fk'
				 ELSE '' END AS key_type
		FROM information_schema.columns c
		LEFT JOIN pk_cols pk ON pk.table_schema = c.table_schema AND pk.table_name = c.table_name AND pk.column_name = c.column_name
		LEFT JOIN fk_cols fk ON fk.table_schema = c.table_schema AND fk.table_name = c.table_name AND fk.column_name = c.column_name
		WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY c.table_schema, c.table_name, c.ordinal_position`

	rows, err = conn.Query(ctx, colSQL)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("columns: %w", err)
	}
	for rows.Next() {
		var schema, table, name, dataType, isNullable, keyType string
		if err := rows.Scan(&schema, &table, &name, &dataType, &isNullable, &keyType); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		if tm := tableMap[tableKey{schema, table}]; tm != nil {
			tm.Columns = append(tm.Columns, ColumnItem{Name: name, DataType: dataType, IsNullable: isNullable, KeyType: keyType})
		}
	}
	rows.Close()

	// ── 4. Primary keys ───────────────────────────────────────────────────────
	rows, err = conn.Query(ctx,
		`SELECT tc.table_schema, tc.table_name, tc.constraint_name,
			string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS cols
		 FROM information_schema.table_constraints tc
		 JOIN information_schema.key_column_usage kcu
			  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		 WHERE tc.constraint_type = 'PRIMARY KEY'
		   AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
		 ORDER BY tc.table_schema, tc.table_name`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("primary keys: %w", err)
	}
	for rows.Next() {
		var schema, table, name, cols string
		if err := rows.Scan(&schema, &table, &name, &cols); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		if tm := tableMap[tableKey{schema, table}]; tm != nil {
			tm.Keys = append(tm.Keys, TableKeyItem{Name: name, Columns: cols})
		}
	}
	rows.Close()

	// ── 5. Foreign keys ───────────────────────────────────────────────────────
	rows, err = conn.Query(ctx,
		`SELECT tc.table_schema, tc.table_name, tc.constraint_name,
			string_agg(DISTINCT kcu.column_name, ', ' ORDER BY kcu.column_name) AS cols,
			MIN(ccu.table_schema) AS ref_schema,
			MIN(ccu.table_name)   AS ref_table,
			string_agg(DISTINCT ccu.column_name, ', ' ORDER BY ccu.column_name) AS ref_cols
		 FROM information_schema.table_constraints tc
		 JOIN information_schema.key_column_usage kcu
			  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		 JOIN information_schema.constraint_column_usage ccu
			  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
		 WHERE tc.constraint_type = 'FOREIGN KEY'
		   AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		 GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
		 ORDER BY tc.table_schema, tc.table_name`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("foreign keys: %w", err)
	}
	for rows.Next() {
		var schema, table, name, cols, refSchema, refTable, refCols string
		if err := rows.Scan(&schema, &table, &name, &cols, &refSchema, &refTable, &refCols); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		if tm := tableMap[tableKey{schema, table}]; tm != nil {
			tm.ForeignKeys = append(tm.ForeignKeys, ForeignKeyItem{Name: name, Columns: cols, RefSchema: refSchema, RefTable: refTable, RefColumns: refCols})
		}
	}
	rows.Close()

	// ── 6. Indexes (excluding primary) ────────────────────────────────────────
	rows, err = conn.Query(ctx,
		`SELECT n.nspname, t.relname, i.relname,
			ix.indisunique,
			string_agg(a.attname, ', ' ORDER BY k.n) AS cols
		 FROM pg_class t
		 JOIN pg_index     ix ON ix.indrelid = t.oid
		 JOIN pg_class      i ON i.oid = ix.indexrelid
		 JOIN pg_namespace  n ON n.oid = t.relnamespace
		 JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, n) ON true
		 JOIN pg_attribute  a ON a.attrelid = t.oid AND a.attnum = k.attnum
		 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		   AND NOT ix.indisprimary
		 GROUP BY n.nspname, t.relname, i.relname, ix.indisunique
		 ORDER BY n.nspname, t.relname, i.relname`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("indexes: %w", err)
	}
	for rows.Next() {
		var schema, table, name, cols string
		var isUnique bool
		if err := rows.Scan(&schema, &table, &name, &isUnique, &cols); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		if tm := tableMap[tableKey{schema, table}]; tm != nil {
			tm.Indexes = append(tm.Indexes, IndexItem{Name: name, IsUnique: isUnique, Columns: cols})
		}
	}
	rows.Close()

	// ── 7. Check constraints ──────────────────────────────────────────────────
	rows, err = conn.Query(ctx,
		`SELECT tc.table_schema, tc.table_name, cc.constraint_name, cc.check_clause
		 FROM information_schema.check_constraints cc
		 JOIN information_schema.table_constraints tc
			  ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.constraint_schema
		 WHERE tc.constraint_type = 'CHECK'
		   AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		   AND cc.check_clause NOT LIKE '%IS NOT NULL%'
		 ORDER BY tc.table_schema, tc.table_name, cc.constraint_name`)
	if err != nil {
		return DatabaseMetadata{}, fmt.Errorf("checks: %w", err)
	}
	for rows.Next() {
		var schema, table, name, def string
		if err := rows.Scan(&schema, &table, &name, &def); err != nil {
			rows.Close()
			return DatabaseMetadata{}, err
		}
		if tm := tableMap[tableKey{schema, table}]; tm != nil {
			tm.Checks = append(tm.Checks, CheckItem{Name: name, Definition: def})
		}
	}
	rows.Close()

	// ── Assemble ──────────────────────────────────────────────────────────────
	schemas := make([]SchemaMetadata, 0, len(schemaOrder))
	for _, sName := range schemaOrder {
		tables := make([]TableMetadata, 0, len(tableOrder[sName]))
		for _, tName := range tableOrder[sName] {
			if tm := tableMap[tableKey{sName, tName}]; tm != nil {
				tables = append(tables, *tm)
			}
		}
		schemas = append(schemas, SchemaMetadata{Name: sName, Tables: tables})
	}

	return DatabaseMetadata{Schemas: schemas, FetchedAt: time.Now()}, nil
}

func (s *DbService) ExecuteQuery(dsId string, sql string) (*QueryResult, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

	start := time.Now()
	rows, err := conn.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fieldDescs := rows.FieldDescriptions()
	columns := make([]string, len(fieldDescs))
	for i, fd := range fieldDescs {
		columns[i] = fd.Name
	}

	results := make([][]interface{}, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		results = append(results, values)
	}

	durationMs := time.Since(start).Milliseconds()

	return &QueryResult{
		Columns:    columns,
		Rows:       results,
		DurationMs: durationMs,
		RowCount:   len(results),
	}, nil
}
