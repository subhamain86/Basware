import type { ReadOnlyQueryConfig, SchemaModel, TableDef } from '../types';
import { buildWhereClause } from './filterEngine';
import { buildDecodeExpression } from './decodeEngine';

// sql-engine.ts — read-only SELECT / WITH generator.

function findTable(schema: SchemaModel, name: string): TableDef | undefined {
  return schema.tables.find((t) => t.name === name);
}

function limitClause(dialect: ReadOnlyQueryConfig['dialect'], limit: number | null): { top: string; tail: string } {
  if (!limit || limit <= 0) return { top: '', tail: '' };
  switch (dialect) {
    case 'SQL Server':
      return { top: `TOP ${limit} `, tail: '' };
    case 'Oracle':
      return { top: '', tail: `\nFETCH FIRST ${limit} ROWS ONLY` };
    case 'PostgreSQL':
    case 'MySQL':
    case 'Generic':
    default:
      return { top: '', tail: `\nLIMIT ${limit}` };
  }
}

export function buildSelectSQL(config: ReadOnlyQueryConfig, schema: SchemaModel): string {
  if (!config.primaryTable) {
    return '-- Select a table to begin building your query.';
  }
  const primary = findTable(schema, config.primaryTable);
  if (!primary) return `-- Unknown table: ${config.primaryTable}`;

  const { top, tail } = limitClause(config.dialect, config.limit);

  const selectCols = config.columns.length
    ? config.columns
        .map((sc) => {
          const table = findTable(schema, sc.table);
          const col = table?.columns.find((c) => c.name === sc.column);
          if (!col) return `${sc.table}.${sc.column}`;
          if (sc.useDecode && col.decode) {
            return `  ${buildDecodeExpression(col, sc.table, config.dialect, sc.alias || undefined)}`;
          }
          const alias = sc.alias ? ` AS ${sc.alias}` : '';
          return `  ${sc.table}.${sc.column}${alias}`;
        })
        .join(',\n')
    : `  ${primary.name}.*`;

  const joinLines = config.joins
    .map((j) => `${j.joinType} ${j.table} ON ${config.primaryTable}.${j.onLeftColumn} = ${j.table}.${j.onRightColumn}`)
    .join('\n');

  const whereClause = buildWhereClause(config.filters);
  const orderClause = config.sorts.length
    ? config.sorts.map((s) => `${s.table}.${s.column} ${s.direction}`).join(', ')
    : '';

  let core = `SELECT ${top}${config.distinct ? 'DISTINCT\n' : '\n'}${selectCols}\nFROM ${primary.name}`;
  if (joinLines) core += `\n${joinLines}`;
  if (whereClause) core += `\nWHERE ${whereClause}`;
  if (config.havingClause.trim()) core += `\nHAVING ${config.havingClause.trim()}`;
  if (orderClause) core += `\nORDER BY ${orderClause}`;
  core += tail;

  if (config.recursive) {
    const pk = primary.columns.find((c) => c.pk)?.name || 'ID';
    core =
      `WITH RECURSIVE hierarchy AS (\n` +
      `  SELECT ${primary.name}.*, 0 AS depth\n` +
      `  FROM ${primary.name}\n` +
      `  WHERE ${primary.name}.${pk} = :root_id\n` +
      `  UNION ALL\n` +
      `  SELECT child.*, hierarchy.depth + 1\n` +
      `  FROM ${primary.name} child\n` +
      `  JOIN hierarchy ON child.PARENT_ID = hierarchy.${pk}\n` +
      `)\n` +
      `SELECT * FROM hierarchy` + tail;
  }

  if (config.saveAsView && config.saveAsView.trim()) {
    return `WITH ${config.saveAsView.trim()} AS (\n${core.split('\n').map((l) => '  ' + l).join('\n')}\n)\nSELECT * FROM ${config.saveAsView.trim()}${tail}`;
  }

  return core;
}

export function buildSchemaOverviewText(schema: SchemaModel): string {
  const modules = Array.from(new Set(schema.tables.map((t) => t.module)));
  return modules.join(', ');
}
