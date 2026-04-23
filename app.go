package main

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// App struct
type App struct {
	ctx           context.Context
	configManager *ConfigManager
	dbService     *DbService
}

// NewApp creates a new App application struct
func NewApp() *App {
	cm, err := NewConfigManager()
	if err != nil {
		// Config manager is required; surface the error clearly rather than
		// continuing with a nil manager that would panic on first use.
		panic(fmt.Sprintf("failed to initialise config manager: %v", err))
	}
	app := &App{
		configManager: cm,
	}
	app.dbService = NewDbService(app)
	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetConfig returns the full configuration
func (a *App) GetConfig() (Config, error) {
	return a.configManager.LoadConfig()
}

// SaveConfig saves the full configuration
func (a *App) SaveConfig(config Config) error {
	return a.configManager.SaveConfig(config)
}

// UpdateDatasource updates an existing datasource by ID
func (a *App) UpdateDatasource(ds Datasource) error {
	return a.configManager.UpdateDatasource(ds)
}

// ListSchemas returns schemas for a datasource
func (a *App) ListSchemas(dsId string) ([]SchemaItem, error) {
	return a.dbService.ListSchemas(dsId)
}

// ListTables returns tables for a schema
func (a *App) ListTables(dsId string, schema string) ([]TableItem, error) {
	return a.dbService.ListTables(dsId, schema)
}

// ListColumns returns columns for a table
func (a *App) ListColumns(dsId string, schema, table string) ([]ColumnItem, error) {
	return a.dbService.ListColumns(dsId, schema, table)
}

// ExecuteQuery executes a SQL query and returns tabular results
func (a *App) ExecuteQuery(dsId string, sql string) (*QueryResult, error) {
	return a.dbService.ExecuteQuery(dsId, sql)
}

type TestConnectionResult struct {
	Success bool
	Message string
}

// TestDatasource attempts a PostgreSQL connection with the supplied credentials.
// sslMode must be one of: disable, require, verify-ca, verify-full.
func (a *App) TestDatasource(host string, port int, database, username, password, sslMode string) TestConnectionResult {
	if sslMode == "" {
		sslMode = "disable"
	}
	ctx := context.Background()
	if a.ctx != nil {
		ctx = a.ctx
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	connString := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s", username, password, host, port, database, sslMode)
	conn, err := pgx.Connect(ctx, connString)
	if err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}
	defer conn.Close(ctx)

	if err := conn.Ping(ctx); err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}

	return TestConnectionResult{Success: true, Message: "Connection successful"}
}
