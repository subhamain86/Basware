// AP-SQL Assistant — shared type definitions

export type Dialect = 'SQL Server' | 'Oracle' | 'PostgreSQL' | 'MySQL' | 'Generic';

export type Theme = 'system' | 'light' | 'dark';

export interface DecodeMap {
  [rawValue: string]: string;
}

export interface ColumnDef {
  name: string;
  label: string;
  type: 'VARCHAR' | 'NUMBER' | 'DATE' | 'FLAG';
  length?: number;
  nullable: boolean;
  pk?: boolean;
  fk?: { table: string; column: string };
  decode?: DecodeMap;
  description: string;
}

export interface TableDef {
  name: string;
  module: string;
  description: string;
  columns: ColumnDef[];
}

export interface SchemaModel {
  version: string;
  updatedAt: string;
  tables: TableDef[];
}

export type FilterOperator =
  | '=' | '<>' | '>' | '>=' | '<' | '<='
  | 'LIKE' | 'NOT LIKE'
  | 'IS NULL' | 'IS NOT NULL'
  | 'IN' | 'NOT IN'
  | 'IS ONE OF' | 'IS NOT ONE OF';

export interface FilterRow {
  id: string;
  table: string;
  column: string;
  operator: FilterOperator;
  value: string;
  combinator: 'AND' | 'OR';
}

export interface JoinDef {
  id: string;
  table: string;
  joinType: 'INNER JOIN' | 'LEFT JOIN';
  onLeftColumn: string;
  onRightColumn: string;
}

export interface SortDef {
  id: string;
  table: string;
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface SelectedColumn {
  id: string;
  table: string;
  column: string;
  alias: string;
  useDecode: boolean;
}

export interface ReadOnlyQueryConfig {
  dialect: Dialect;
  primaryTable: string | null;
  columns: SelectedColumn[];
  joins: JoinDef[];
  filters: FilterRow[];
  sorts: SortDef[];
  limit: number | null;
  distinct: boolean;
  saveAsView: string | null;
  onlyMatching: boolean;
  havingClause: string;
  recursive: boolean;
}

export type CrQueryType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface CrValueRow {
  id: string;
  column: string;
  value: string;
}

export interface CrQueryConfig {
  dialect: Dialect;
  queryType: CrQueryType;
  table: string | null;
  values: CrValueRow[];
  filters: FilterRow[];
  confirmNoWhere: boolean;
}

export interface TourStep {
  targetSelector: string;
  title: string;
  body: string;
}
