// Shared domain types mirroring Go structs in config.go

export interface Project {
  id: string;
  name: string;
}

export interface Datasource {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  projectId: string;
  env: string;    // local | dev | stg | prod
  sslMode: string; // disable | require | verify-ca | verify-full
}
