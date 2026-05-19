export namespace main {
	
	export class CheckItem {
	    name: string;
	    definition: string;
	
	    static createFrom(source: any = {}) {
	        return new CheckItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.definition = source["definition"];
	    }
	}
	export class ColumnItem {
	    name: string;
	    dataType: string;
	    isNullable: string;
	    keyType: string;
	
	    static createFrom(source: any = {}) {
	        return new ColumnItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.dataType = source["dataType"];
	        this.isNullable = source["isNullable"];
	        this.keyType = source["keyType"];
	    }
	}
	export class CompletionEntry {
	    kind: string;
	    schema: string;
	    table: string;
	    name: string;
	    dataType: string;
	    keyType: string;
	
	    static createFrom(source: any = {}) {
	        return new CompletionEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.schema = source["schema"];
	        this.table = source["table"];
	        this.name = source["name"];
	        this.dataType = source["dataType"];
	        this.keyType = source["keyType"];
	    }
	}
	export class CompletionSet {
	    entries: CompletionEntry[];
	
	    static createFrom(source: any = {}) {
	        return new CompletionSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entries = this.convertValues(source["entries"], CompletionEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Datasource {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    database: string;
	    username: string;
	    password: string;
	    projectId: string;
	    env: string;
	    sslMode: string;
	
	    static createFrom(source: any = {}) {
	        return new Datasource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.database = source["database"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.projectId = source["projectId"];
	        this.env = source["env"];
	        this.sslMode = source["sslMode"];
	    }
	}
	export class Project {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class Config {
	    projects: Project[];
	    datasources: Datasource[];
	    theme?: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projects = this.convertValues(source["projects"], Project);
	        this.datasources = this.convertValues(source["datasources"], Datasource);
	        this.theme = source["theme"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IndexItem {
	    name: string;
	    isUnique: boolean;
	    columns: string;
	
	    static createFrom(source: any = {}) {
	        return new IndexItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isUnique = source["isUnique"];
	        this.columns = source["columns"];
	    }
	}
	export class ForeignKeyItem {
	    name: string;
	    columns: string;
	    refSchema: string;
	    refTable: string;
	    refColumns: string;
	
	    static createFrom(source: any = {}) {
	        return new ForeignKeyItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.columns = source["columns"];
	        this.refSchema = source["refSchema"];
	        this.refTable = source["refTable"];
	        this.refColumns = source["refColumns"];
	    }
	}
	export class TableKeyItem {
	    name: string;
	    columns: string;
	
	    static createFrom(source: any = {}) {
	        return new TableKeyItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.columns = source["columns"];
	    }
	}
	export class TableMetadata {
	    name: string;
	    type: string;
	    columns: ColumnItem[];
	    keys: TableKeyItem[];
	    foreignKeys: ForeignKeyItem[];
	    indexes: IndexItem[];
	    checks: CheckItem[];
	
	    static createFrom(source: any = {}) {
	        return new TableMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.columns = this.convertValues(source["columns"], ColumnItem);
	        this.keys = this.convertValues(source["keys"], TableKeyItem);
	        this.foreignKeys = this.convertValues(source["foreignKeys"], ForeignKeyItem);
	        this.indexes = this.convertValues(source["indexes"], IndexItem);
	        this.checks = this.convertValues(source["checks"], CheckItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SchemaMetadata {
	    name: string;
	    tables: TableMetadata[];
	
	    static createFrom(source: any = {}) {
	        return new SchemaMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.tables = this.convertValues(source["tables"], TableMetadata);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DatabaseMetadata {
	    schemas: SchemaMetadata[];
	    // Go type: time
	    fetchedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseMetadata(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schemas = this.convertValues(source["schemas"], SchemaMetadata);
	        this.fetchedAt = this.convertValues(source["fetchedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class HistoryEntry {
	    id: string;
	    sql: string;
	    rowCount: number;
	    durationMs: number;
	    executedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sql = source["sql"];
	        this.rowCount = source["rowCount"];
	        this.durationMs = source["durationMs"];
	        this.executedAt = source["executedAt"];
	    }
	}
	
	
	export class QueryResult {
	    columns: string[];
	    rows: any[][];
	    durationMs: number;
	    rowCount: number;
	    truncated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.durationMs = source["durationMs"];
	        this.rowCount = source["rowCount"];
	        this.truncated = source["truncated"];
	    }
	}
	export class SavedQuery {
	    filename: string;
	
	    static createFrom(source: any = {}) {
	        return new SavedQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	    }
	}
	export class SchemaItem {
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new SchemaItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	    }
	}
	
	export class TableItem {
	    schema: string;
	    name: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new TableItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.schema = source["schema"];
	        this.name = source["name"];
	        this.type = source["type"];
	    }
	}
	
	
	export class TestConnectionResult {
	    Success: boolean;
	    Message: string;
	
	    static createFrom(source: any = {}) {
	        return new TestConnectionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Success = source["Success"];
	        this.Message = source["Message"];
	    }
	}

}

