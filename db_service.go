package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type DbService struct {
	app             *App
	completionCache sync.Map // dsID → *CompletionSet
}

func NewDbService(app *App) *DbService {
	return &DbService{app: app}
}

// openConn dials a fresh connection for dsID with the given timeout.
// The returned cleanup func closes the connection then cancels the context;
// callers must defer it immediately after a nil-error check.
func (s *DbService) openConn(dsID string, timeout time.Duration) (*pgx.Conn, context.Context, func(), error) {
	config, err := s.app.configManager.LoadConfig()
	if err != nil {
		return nil, nil, nil, err
	}

	var ds *Datasource
	for _, d := range config.Datasources {
		if d.ID == dsID {
			ds = &d
			break
		}
	}
	if ds == nil {
		return nil, nil, nil, fmt.Errorf("datasource %s not found", dsID)
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
	// Close before cancel so conn.Close receives a live context.
	cleanup := func() {
		_ = conn.Close(ctx)
		cancel()
	}
	return conn, ctx, cleanup, nil
}

func (s *DbService) ListSchemas(dsID string) ([]SchemaItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	rows, err := conn.Query(ctx,
		`SELECT schema_name FROM information_schema.schemata
		 WHERE schema_name NOT IN ('information_schema', 'pg_catalog')`)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return schemas, nil
}

func (s *DbService) ListTables(dsID string, schema string) ([]TableItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	rows, err := conn.Query(ctx,
		`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1`,
		schema)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tables, nil
}

func (s *DbService) ListColumns(dsID string, schema, table string) ([]ColumnItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return columns, nil
}

func (s *DbService) ListTableKeys(dsID, schema, table string) ([]TableKeyItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *DbService) ListTableForeignKeys(dsID, schema, table string) ([]ForeignKeyItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *DbService) ListTableIndexes(dsID, schema, table string) ([]IndexItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *DbService) ListTableChecks(dsID, schema, table string) ([]CheckItem, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	const q = `
		SELECT cc.constraint_name, cc.check_clause
		FROM information_schema.check_constraints cc
		JOIN information_schema.table_constraints tc
		     ON cc.constraint_name   = tc.constraint_name
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// GetCompletions returns all schemas, tables, views, and columns for a datasource.
// Results are cached in-memory per dsID (cache is invalidated on process restart).
func (s *DbService) GetCompletions(dsID string) (*CompletionSet, error) {
	if cached, ok := s.completionCache.Load(dsID); ok {
		return cached.(*CompletionSet), nil
	}

	conn, ctx, cleanup, err := s.openConn(dsID, 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	var entries []CompletionEntry

	// Schemas — must close before next query on the same connection.
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
	if err := schemaRows.Err(); err != nil {
		schemaRows.Close()
		return nil, err
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
	if err := tableRows.Err(); err != nil {
		tableRows.Close()
		return nil, err
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
	if err := colRows.Err(); err != nil {
		colRows.Close()
		return nil, err
	}
	colRows.Close()

	result := &CompletionSet{Entries: entries}
	s.completionCache.Store(dsID, result)
	return result, nil
}

const maxQueryRows = 1000

func (s *DbService) ExecuteQuery(dsID string, sql string) (*QueryResult, error) {
	conn, ctx, cleanup, err := s.openConn(dsID, 30*time.Second)
	if err != nil {
		return nil, err
	}
	defer cleanup()

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

	results := make([][]interface{}, 0, maxQueryRows)
	truncated := false
	for rows.Next() {
		if len(results) >= maxQueryRows {
			truncated = true
			break
		}
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		for i, v := range values {
			if b, ok := v.([16]byte); ok {
				values[i] = fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
			}
		}
		results = append(results, values)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &QueryResult{
		Columns:    columns,
		Rows:       results,
		DurationMs: time.Since(start).Milliseconds(),
		RowCount:   len(results),
		Truncated:  truncated,
	}, nil
}
