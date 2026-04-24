package main

import (
	"context"
	"fmt"
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
}

type QueryResult struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
}

type DbService struct {
	app *App
}

func NewDbService(app *App) *DbService {
	return &DbService{app: app}
}

func (s *DbService) getConnection(dsId string) (*pgx.Conn, context.Context, context.CancelFunc, error) {
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	connString := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s", ds.Username, ds.Password, ds.Host, ds.Port, ds.Database, sslMode)
	conn, err := pgx.Connect(ctx, connString)
	if err != nil {
		cancel()
		return nil, nil, nil, err
	}

	return conn, ctx, cancel, nil
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

	rows, err := conn.Query(ctx, "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position", schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make([]ColumnItem, 0)
	for rows.Next() {
		var name, dataType, isNullable string
		if err := rows.Scan(&name, &dataType, &isNullable); err != nil {
			return nil, err
		}
		columns = append(columns, ColumnItem{Name: name, DataType: dataType, IsNullable: isNullable})
	}

	return columns, nil
}

func (s *DbService) ExecuteQuery(dsId string, sql string) (*QueryResult, error) {
	conn, ctx, cancel, err := s.getConnection(dsId)
	if err != nil {
		return nil, err
	}
	defer conn.Close(ctx)
	defer cancel()

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

	return &QueryResult{
		Columns: columns,
		Rows:    results,
	}, nil
}
