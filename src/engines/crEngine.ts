import type { CrQueryConfig, SchemaModel } from '../types';
import { buildWhereClause } from './filterEngine';

// cr-engine.ts — INSERT / UPDATE / DELETE generator for Change Requests.

export interface CrBuildResult {
  sql: string;
  blocked: boolean;
  reason?: string;
}

export function buildCrSQL(config: CrQueryConfig, _schema: SchemaModel): CrBuildResult {
  if (!config.table) {
    return { sql: '-- Choose a table for this Change Request.', blocked: true, reason: 'No table selected.' };
  }

  const whereClause = buildWhereClause(config.filters);
  const needsWhere = config.queryType === 'UPDATE' || config.queryType === 'DELETE';

  if (needsWhere && !whereClause && !config.confirmNoWhere) {
    return {
      sql: '-- A WHERE condition is required to identify which records should be updated or deleted.\n-- Add at least one filter, or explicitly confirm this query should have no WHERE condition.',
      blocked: true,
      reason: 'Missing mandatory WHERE clause.'
    };
  }

  if (config.queryType === 'INSERT') {
    if (config.values.length === 0) {
      return { sql: '-- Add at least one column/value pair to build an INSERT statement.', blocked: true };
    }
    const cols = config.values.map((v) => v.column).join(', ');
    const vals = config.values.map((v) => formatValue(v.value)).join(', ');
    return { sql: `INSERT INTO ${config.table} (${cols})\nVALUES (${vals});`, blocked: false };
  }

  if (config.queryType === 'UPDATE') {
    if (config.values.length === 0) {
      return { sql: '-- Add at least one column/value pair to build an UPDATE statement.', blocked: true };
    }
    const setClause = config.values.map((v) => `${v.column} = ${formatValue(v.value)}`).join(',\n  ');
    let sql = `UPDATE ${config.table}\nSET ${setClause}`;
    sql += whereClause ? `\nWHERE ${whereClause};` : '\n-- ⚠ No WHERE condition (explicitly confirmed) — this will affect ALL rows.;';
    return { sql, blocked: false };
  }

  let sql = `DELETE FROM ${config.table}`;
  sql += whereClause ? `\nWHERE ${whereClause};` : '\n-- ⚠ No WHERE condition (explicitly confirmed) — this will affect ALL rows.;';
  return { sql, blocked: false };
}

function formatValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return 'NULL';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^(sysdate|getdate\(\)|now\(\)|current_date|current_timestamp)$/i.test(trimmed)) return trimmed.toUpperCase();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
}
