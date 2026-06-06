package main

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version and BuildDate are set at build time via -ldflags.
var (
	Version   = "0.0.1"
	BuildDate = ""
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
	// Surface non-fatal config/Keychain warnings to the frontend as toasts.
	a.configManager.notify = func(level, message string) {
		wruntime.EventsEmit(ctx, "snowy:notification", map[string]string{
			"level":   level,
			"message": message,
		})
	}
}

// GetAppVersion returns the app version and build date.
func (a *App) GetAppVersion() map[string]string {
	return map[string]string{"version": Version, "buildDate": BuildDate}
}

// GetConfig returns the full configuration
func (a *App) GetConfig() (Config, error) {
	return a.configManager.LoadConfig()
}

// SaveConfig saves the full configuration
func (a *App) SaveConfig(config Config) error {
	return a.configManager.SaveConfig(config)
}

// UpdateDatasource updates an existing datasource by ID and closes its pool
// so the next call picks up the new credentials.
func (a *App) UpdateDatasource(ds Datasource) error {
	if err := a.configManager.UpdateDatasource(ds); err != nil {
		return err
	}
	a.dbService.closePool(ds.ID)
	return nil
}

// ClosePool shuts down the connection pool for dsID. Call this on disconnect.
func (a *App) ClosePool(dsID string) {
	a.dbService.closePool(dsID)
}

// ListSchemas returns schemas for a datasource
func (a *App) ListSchemas(dsID string) ([]SchemaItem, error) {
	return a.dbService.ListSchemas(dsID)
}

// ListTables returns tables for a schema
func (a *App) ListTables(dsID string, schema string) ([]TableItem, error) {
	return a.dbService.ListTables(dsID, schema)
}

// ListColumns returns columns for a table
func (a *App) ListColumns(dsID string, schema, table string) ([]ColumnItem, error) {
	return a.dbService.ListColumns(dsID, schema, table)
}

// ExecuteQuery executes a SQL query and returns tabular results
func (a *App) ExecuteQuery(dsID string, sql string) (*QueryResult, error) {
	return a.dbService.ExecuteQuery(dsID, sql)
}

// SaveQuery saves a SQL query to disk under ~/.snowy/queries/<dsID>/.
func (a *App) SaveQuery(dsID, filename, sql string) error {
	return SaveQuery(dsID, filename, sql)
}

// ListSavedQueries lists .sql files saved for a datasource.
func (a *App) ListSavedQueries(dsID string) ([]SavedQuery, error) {
	return ListSavedQueries(dsID)
}

// LoadSavedQuery reads a saved query file.
func (a *App) LoadSavedQuery(dsID, filename string) (string, error) {
	return LoadSavedQuery(dsID, filename)
}

// DeleteSavedQuery removes a saved query file.
func (a *App) DeleteSavedQuery(dsID, filename string) error {
	return DeleteSavedQuery(dsID, filename)
}

// RenameQuery renames a saved query file.
func (a *App) RenameQuery(dsID, oldName, newName string) error {
	return RenameQuery(dsID, oldName, newName)
}

// ListTableKeys returns primary key constraints for a table.
func (a *App) ListTableKeys(dsID, schema, table string) ([]TableKeyItem, error) {
	return a.dbService.ListTableKeys(dsID, schema, table)
}

// ListTableForeignKeys returns foreign key constraints for a table.
func (a *App) ListTableForeignKeys(dsID, schema, table string) ([]ForeignKeyItem, error) {
	return a.dbService.ListTableForeignKeys(dsID, schema, table)
}

// ListTableIndexes returns non-primary indexes for a table.
func (a *App) ListTableIndexes(dsID, schema, table string) ([]IndexItem, error) {
	return a.dbService.ListTableIndexes(dsID, schema, table)
}

// ListTableChecks returns check constraints for a table.
func (a *App) ListTableChecks(dsID, schema, table string) ([]CheckItem, error) {
	return a.dbService.ListTableChecks(dsID, schema, table)
}

// GetCompletions returns DB-aware autocomplete entries (schemas, tables, views, columns)
// for the given datasource. Results are cached in-memory.
func (a *App) GetCompletions(dsID string) (*CompletionSet, error) {
	return a.dbService.GetCompletions(dsID)
}

// GetCachedMetadata returns the last saved DatabaseMetadata for a datasource.
// Returns an empty DatabaseMetadata (no schemas) if no cache file exists.
func (a *App) GetCachedMetadata(dsID string) (DatabaseMetadata, error) {
	return a.dbService.LoadCachedMetadata(dsID)
}

// RefreshMetadata fetches fresh DatabaseMetadata from the DB, saves it to the
// local cache at ~/.snowy/cache/<dsID>.json, and returns it.
// It also rebuilds the in-memory completion cache from the fresh metadata so
// that GetCompletions returns up-to-date results without an extra DB call.
func (a *App) RefreshMetadata(dsID string) (DatabaseMetadata, error) {
	meta, err := a.dbService.FetchDatabaseMetadata(dsID)
	if err != nil {
		return DatabaseMetadata{}, err
	}
	_ = a.dbService.SaveMetadataCache(dsID, meta)
	a.dbService.cacheCompletionsFromMetadata(dsID, meta)
	return meta, nil
}

// RecordHistory appends a query execution record to ~/.snowy/history/<dsID>.jsonl.
func (a *App) RecordHistory(dsID, sql string, rowCount int, durationMs int64) error {
	return RecordHistory(dsID, sql, rowCount, durationMs)
}

// GetQueryHistory returns the last limit history entries for a datasource, newest first.
func (a *App) GetQueryHistory(dsID string, limit int) ([]HistoryEntry, error) {
	return GetQueryHistory(dsID, limit)
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

	connConfig, err := pgx.ParseConfig(fmt.Sprintf("host=%s port=%d dbname=%s user=%s sslmode=%s",
		host, port, database, username, sslMode))
	if err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}
	connConfig.Password = password
	conn, err := pgx.ConnectConfig(ctx, connConfig)
	if err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}
	defer conn.Close(ctx)

	if err := conn.Ping(ctx); err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}

	return TestConnectionResult{Success: true, Message: "Connection successful"}
}

// PingDatasource looks up a saved datasource by ID and pings it.
func (a *App) PingDatasource(dsID string) TestConnectionResult {
	cfg, err := a.configManager.LoadConfig()
	if err != nil {
		return TestConnectionResult{Success: false, Message: err.Error()}
	}
	var ds *Datasource
	for i := range cfg.Datasources {
		if cfg.Datasources[i].ID == dsID {
			ds = &cfg.Datasources[i]
			break
		}
	}
	if ds == nil {
		return TestConnectionResult{Success: false, Message: "datasource not found"}
	}
	// Password is not stored in config — load from Keychain.
	if pw, err := a.configManager.GetDatasourcePassword(dsID); err == nil {
		ds.Password = pw
	}
	return a.TestDatasource(ds.Host, ds.Port, ds.Database, ds.Username, ds.Password, ds.SSLMode)
}
