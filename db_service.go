package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// maxQueryRows caps rows returned by ExecuteQuery; extra rows set Truncated.
	maxQueryRows = 1000
	// poolMaxConns is the per-datasource pgxpool connection ceiling.
	poolMaxConns = 5
	// introspectTimeout bounds schema/table/column/key introspection queries.
	introspectTimeout = 10 * time.Second
	// queryTimeout bounds user-issued queries run through ExecuteQuery.
	queryTimeout = 30 * time.Second
)

type DbService struct {
	app             *App
	completionCache sync.Map // dsID → *CompletionSet
	pools           sync.Map // dsID → *pgxpool.Pool
	poolMu          sync.Mutex
}

func NewDbService(app *App) *DbService {
	return &DbService{app: app}
}

// getPool returns the existing pool for dsID, creating one on first call.
// Pool creation is serialised by poolMu; subsequent calls return from cache.
func (s *DbService) getPool(dsID string) (*pgxpool.Pool, error) {
	if v, ok := s.pools.Load(dsID); ok {
		return v.(*pgxpool.Pool), nil
	}

	s.poolMu.Lock()
	defer s.poolMu.Unlock()

	// Re-check after acquiring lock — another goroutine may have created it.
	if v, ok := s.pools.Load(dsID); ok {
		return v.(*pgxpool.Pool), nil
	}

	config, err := s.app.configManager.LoadConfig()
	if err != nil {
		return nil, err
	}
	var ds *Datasource
	for _, d := range config.Datasources {
		if d.ID == dsID {
			ds = &d
			break
		}
	}
	if ds == nil {
		return nil, fmt.Errorf("datasource %s not found", dsID)
	}

	sslMode := ds.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	connStr := fmt.Sprintf("host=%s port=%d dbname=%s user=%s sslmode=%s",
		ds.Host, ds.Port, ds.Database, ds.Username, sslMode)
	poolCfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, err
	}
	password, err := s.app.configManager.GetDatasourcePassword(dsID)
	if err != nil {
		return nil, fmt.Errorf("no password stored in macOS Keychain for connection %q — open Connection Manager, re-enter the password, and click OK", ds.Name)
	}
	poolCfg.ConnConfig.Password = password
	poolCfg.MaxConns = poolMaxConns
	poolCfg.MinConns = 0
	poolCfg.MaxConnIdleTime = 5 * time.Minute
	poolCfg.MaxConnLifetime = 30 * time.Minute
	poolCfg.HealthCheckPeriod = 1 * time.Minute // explicit; matches pgxpool v5 default

	pool, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		return nil, err
	}
	s.pools.Store(dsID, pool)
	return pool, nil
}

// acquire borrows a connection from the pool for dsID.
// Callers must defer conn.Release() immediately after a nil-error check.
// If the pool returns an error (e.g. after long idle when NAT/firewall closed
// the underlying TCP connections), the stale pool is discarded and one retry
// is attempted with a freshly created pool.
func (s *DbService) acquire(ctx context.Context, dsID string) (*pgxpool.Conn, error) {
	pool, err := s.getPool(dsID)
	if err != nil {
		return nil, err
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return nil, err // context cancelled/expired — retry won't help
		}
		// Pool may contain stale connections after long idle; reset and retry once.
		s.closePool(dsID)
		pool, err = s.getPool(dsID)
		if err != nil {
			return nil, err
		}
		return pool.Acquire(ctx)
	}
	return conn, nil
}

// closePool shuts down the pool for dsID and evicts its completion cache entry.
// Call on disconnect or when datasource credentials change.
func (s *DbService) closePool(dsID string) {
	if v, ok := s.pools.LoadAndDelete(dsID); ok {
		v.(*pgxpool.Pool).Close()
	}
	s.completionCache.Delete(dsID)
}

func (s *DbService) ListSchemas(dsID string) ([]SchemaItem, error) {
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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
	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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

// cacheCompletionsFromMetadata builds a CompletionSet from already-fetched
// DatabaseMetadata and stores it in completionCache, replacing any stale entry.
// Called by RefreshMetadata so completions stay in sync with no extra DB call.
func (s *DbService) cacheCompletionsFromMetadata(dsID string, meta DatabaseMetadata) {
	entries := make([]CompletionEntry, 0)
	for _, schema := range meta.Schemas {
		entries = append(entries, CompletionEntry{Kind: "schema", Name: schema.Name})
		for _, table := range schema.Tables {
			kind := "table"
			if table.Type == "VIEW" {
				kind = "view"
			}
			entries = append(entries, CompletionEntry{Kind: kind, Schema: schema.Name, Name: table.Name})
			for _, col := range table.Columns {
				entries = append(entries, CompletionEntry{
					Kind:     "column",
					Schema:   schema.Name,
					Table:    table.Name,
					Name:     col.Name,
					DataType: col.DataType,
					KeyType:  col.KeyType,
				})
			}
		}
	}
	s.completionCache.Store(dsID, &CompletionSet{Entries: entries})
}

// GetCompletions returns all schemas, tables, views, and columns for a datasource.
// Results are cached in-memory per dsID (cache is invalidated when the pool is closed).
func (s *DbService) GetCompletions(dsID string) (*CompletionSet, error) {
	if cached, ok := s.completionCache.Load(dsID); ok {
		return cached.(*CompletionSet), nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), introspectTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, err
	}
	defer conn.Release()

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

// queryTimeoutError rewrites the generic context-deadline error into a message
// that names the queryTimeout budget; unrelated errors pass through unchanged.
func queryTimeoutError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("query exceeded the %s timeout", queryTimeout)
	}
	return err
}

func (s *DbService) ExecuteQuery(dsID string, sql string) (*QueryResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), queryTimeout)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return nil, queryTimeoutError(err)
	}
	defer conn.Release()

	start := time.Now()
	rows, err := conn.Query(ctx, sql)
	if err != nil {
		return nil, queryTimeoutError(err)
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
			return nil, queryTimeoutError(err)
		}
		for i, v := range values {
			// pgx decodes a uuid column as [16]byte; format only those, matching on
			// the column's type OID so an unrelated 16-byte value isn't misrendered.
			if b, ok := v.([16]byte); ok && fieldDescs[i].DataTypeOID == pgtype.UUIDOID {
				values[i] = fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
			}
		}
		results = append(results, values)
	}
	if err := rows.Err(); err != nil {
		return nil, queryTimeoutError(err)
	}

	// CommandTag carries the affected-row count for DML and the command verb for any
	// statement, but it is only reliable once the result is fully consumed. That holds
	// for DML/DDL (no result rows, so the command completed when rows.Next() returned
	// false) and for a fully-read SELECT. A truncated SELECT breaks out of the loop
	// early, leaving the tag possibly empty — acceptable because RowsAffected/Command
	// are only consumed for non-result-set statements (empty Columns), never for SELECT.
	tag := rows.CommandTag()
	command := ""
	if parts := strings.Fields(tag.String()); len(parts) > 0 {
		command = parts[0]
	}

	return &QueryResult{
		Columns:      columns,
		Rows:         results,
		DurationMs:   time.Since(start).Milliseconds(),
		RowCount:     len(results),
		Truncated:    truncated,
		RowsAffected: tag.RowsAffected(),
		Command:      command,
	}, nil
}
