package main

import "time"

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
	Default    string `json:"default"` // column default expression, "" if none
	KeyType    string `json:"keyType"` // "pk" | "fk" | ""
}

type QueryResult struct {
	Columns      []string        `json:"columns"`
	Rows         [][]interface{} `json:"rows"`
	DurationMs   int64           `json:"durationMs"`
	RowCount     int             `json:"rowCount"`
	Truncated    bool            `json:"truncated"`
	RowsAffected int64           `json:"rowsAffected"` // from CommandTag, for non-SELECT statements
	Command      string          `json:"command"`      // command verb, e.g. "UPDATE", "DROP" (empty for SELECT)
}

// CompletionEntry represents a single autocomplete item (schema, table, view, or column).
type CompletionEntry struct {
	Kind     string `json:"kind"` // "schema" | "table" | "view" | "column"
	Schema   string `json:"schema"`
	Table    string `json:"table"` // empty for schema-kind entries
	Name     string `json:"name"`
	DataType string `json:"dataType"` // non-empty for column-kind entries
	KeyType  string `json:"keyType"`  // "pk" | "fk" | "" — only for column-kind entries
}

// CompletionSet is the full set of DB-aware completions for a datasource.
type CompletionSet struct {
	Entries []CompletionEntry `json:"entries"`
}

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
