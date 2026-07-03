package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// columnClassificationSQL classifies each column as 'pk'/'fk'/” via a CTE +
// LEFT JOIN (one pass, no correlated per-row subqueries). Shared by ListColumns
// and FetchDatabaseMetadata so the rule has a single definition.
//
// $1 = schema, $2 = table. Passing NULL for both selects every user-schema
// table (whole-DB mode) and excludes the system schemas; passing a concrete
// schema/table scopes to exactly that table (per-table mode).
const columnClassificationSQL = `
	WITH pk_cols AS (
		SELECT tc.table_schema, tc.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
	),
	fk_cols AS (
		SELECT tc.table_schema, tc.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
			ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
	)
	SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable,
		CASE WHEN pk.column_name IS NOT NULL THEN 'pk'
			 WHEN fk.column_name IS NOT NULL THEN 'fk'
			 ELSE '' END AS key_type
	FROM information_schema.columns c
	LEFT JOIN pk_cols pk
		ON pk.table_schema = c.table_schema AND pk.table_name = c.table_name AND pk.column_name = c.column_name
	LEFT JOIN fk_cols fk
		ON fk.table_schema = c.table_schema AND fk.table_name = c.table_name AND fk.column_name = c.column_name
	WHERE ($1::text IS NULL OR c.table_schema = $1)
	  AND ($2::text IS NULL OR c.table_name = $2)
	  AND ($1::text IS NOT NULL OR c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast'))
	ORDER BY c.table_schema, c.table_name, c.ordinal_position`

// metadataCachePath returns ~/.snowy/cache/<dsID>.json, creating the dir if needed.
func metadataCachePath(dsID string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".snowy", "cache")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(dir, dsID+".json"), nil
}

// LoadCachedMetadata reads a previously saved DatabaseMetadata from disk.
// Returns an empty DatabaseMetadata (no schemas) if the file does not exist.
func (s *DbService) LoadCachedMetadata(dsID string) (DatabaseMetadata, error) {
	empty := DatabaseMetadata{Schemas: make([]SchemaMetadata, 0)}
	path, err := metadataCachePath(dsID)
	if err != nil {
		return empty, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return empty, nil
	}
	var meta DatabaseMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return empty, nil
	}
	if meta.Schemas == nil {
		meta.Schemas = make([]SchemaMetadata, 0)
	}
	return meta, nil
}

// SaveMetadataCache writes metadata to disk. Errors are non-fatal (caller ignores).
func (s *DbService) SaveMetadataCache(dsID string, meta DatabaseMetadata) error {
	path, err := metadataCachePath(dsID)
	if err != nil {
		return err
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// FetchDatabaseMetadata fetches schemas, tables, columns, keys, foreign keys,
// indexes, and checks in 7 sequential queries using a pooled connection.
func (s *DbService) FetchDatabaseMetadata(dsID string) (DatabaseMetadata, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	conn, err := s.acquire(ctx, dsID)
	if err != nil {
		return DatabaseMetadata{}, err
	}
	defer conn.Release()

	type tableKey struct{ schema, table string }
	tableMap := make(map[tableKey]*TableMetadata)
	schemaOrder := make([]string, 0)
	seenSchemas := make(map[string]bool)
	tableOrder := make(map[string][]string) // schema → ordered table names

	// 1. Schemas
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("schemas: %w", err)
	}
	rows.Close()

	// 2. Tables
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("tables: %w", err)
	}
	rows.Close()

	// 3. Columns — shared CTE-based pk/fk classification (see columnClassificationSQL).
	// Passing NULL for both params selects every user-schema table.
	rows, err = conn.Query(ctx, columnClassificationSQL, nil, nil)
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("columns: %w", err)
	}
	rows.Close()

	// 4. Primary keys
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("primary keys: %w", err)
	}
	rows.Close()

	// 5. Foreign keys
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
			tm.ForeignKeys = append(tm.ForeignKeys, ForeignKeyItem{
				Name: name, Columns: cols,
				RefSchema: refSchema, RefTable: refTable, RefColumns: refCols,
			})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("foreign keys: %w", err)
	}
	rows.Close()

	// 6. Indexes (excluding primary key indexes)
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("indexes: %w", err)
	}
	rows.Close()

	// 7. Check constraints
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
	if err := rows.Err(); err != nil {
		rows.Close()
		return DatabaseMetadata{}, fmt.Errorf("checks: %w", err)
	}
	rows.Close()

	// Assemble ordered result
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
