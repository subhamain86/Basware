export type ColumnDataType = 'VARCHAR' | 'NUMBER' | 'DATE' | 'FLAG' | 'TIMESTAMP';
export const VALID_DATA_TYPES: ColumnDataType[] = ['VARCHAR', 'NUMBER', 'DATE', 'FLAG', 'TIMESTAMP'];

export interface DecodeEntry { rawValue: string; label: string; }

export interface ColumnDef {
  name: string;
  label: string;
  type: ColumnDataType;
  length?: number;
  precision?: number;
  nullable: boolean;
  alias?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: { table: string; column: string };
  decode?: DecodeEntry[];
  description: string;
}

export interface TableDef { name: string; module: string; description: string; columns: ColumnDef[]; }

export interface RelationshipDef {
  id: string; fromTable: string; fromColumn: string; toTable: string; toColumn: string;
  kind: 'one-to-many' | 'many-to-one' | 'one-to-one';
}

export type SchemaStatus = 'active' | 'default' | 'inactive';

export interface SchemaModel {
  id: string; name: string; version: string; status: SchemaStatus; updatedAt: string;
  lastSyncedAt: string | null; tables: TableDef[]; relationships: RelationshipDef[];
}

export interface SchemaRegistry { schemas: SchemaModel[]; activeSchemaId: string; }

/** A single flattened row used by the Manual Schema Editor's data grid —
 * one row per column, carrying its parent table's metadata alongside. */
export interface SchemaEditorRow {
  rowId: string; // `${tableName}::${columnName}`
  module: string;
  tableName: string;
  tableDescription: string;
  columnName: string;
  columnDescription: string;
  dataType: ColumnDataType;
  length: number | null;
  precision: number | null;
  nullable: boolean;
  alias: string;
  decodeText: string; // "RAW=Label" pairs, one per line
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  fkTable: string;
  fkColumn: string;
}

export interface SchemaIntegrityIssue { severity: 'error' | 'warning'; message: string; }
export interface SchemaIntegrityResult { valid: boolean; issues: SchemaIntegrityIssue[]; }
