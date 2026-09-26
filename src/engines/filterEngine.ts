import type { FilterRow, FilterOperator } from '../types';

// filter-engine.ts — multi-column WHERE filter engine, shared by the Read Only
// and Change Request builders.

const NO_VALUE_OPERATORS: FilterOperator[] = ['IS NULL', 'IS NOT NULL'];
const LIST_OPERATORS: FilterOperator[] = ['IN', 'NOT IN', 'IS ONE OF', 'IS NOT ONE OF'];

function quoteIfNeeded(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return "''";
  const isNumeric = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (isNumeric) return trimmed;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
}

function buildListLiteral(raw: string): string {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(quoteIfNeeded);
  return `(${parts.join(', ')})`;
}

export function renderFilterCondition(f: FilterRow): string {
  const col = `${f.table}.${f.column}`;
  if (NO_VALUE_OPERATORS.includes(f.operator)) {
    return `${col} ${f.operator}`;
  }
  if (LIST_OPERATORS.includes(f.operator)) {
    const sqlOp = f.operator === 'IS ONE OF' ? 'IN' : f.operator === 'IS NOT ONE OF' ? 'NOT IN' : f.operator;
    return `${col} ${sqlOp} ${buildListLiteral(f.value)}`;
  }
  if (f.operator === 'LIKE' || f.operator === 'NOT LIKE') {
    const val = f.value.includes('%') ? f.value : `%${f.value}%`;
    return `${col} ${f.operator} ${quoteIfNeeded(val)}`;
  }
  return `${col} ${f.operator} ${quoteIfNeeded(f.value)}`;
}

export function buildWhereClause(filters: FilterRow[]): string {
  if (filters.length === 0) return '';
  const parts: string[] = [];
  filters.forEach((f, idx) => {
    const cond = renderFilterCondition(f);
    if (idx === 0) {
      parts.push(cond);
    } else {
      parts.push(`${f.combinator} ${cond}`);
    }
  });
  return parts.join('\n  ');
}

export function requiresValue(op: FilterOperator): boolean {
  return !NO_VALUE_OPERATORS.includes(op);
}

export const FILTER_OPERATORS: FilterOperator[] = [
  '=', '<>', '>', '>=', '<', '<=',
  'LIKE', 'NOT LIKE',
  'IS NULL', 'IS NOT NULL',
  'IN', 'NOT IN',
  'IS ONE OF', 'IS NOT ONE OF'
];
