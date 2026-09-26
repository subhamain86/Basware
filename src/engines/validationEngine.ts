import type { ReadOnlyQueryConfig, CrQueryConfig } from '../types';

// validation-engine.ts — schema-aware request validation.

export function validateReadOnly(config: ReadOnlyQueryConfig): string[] {
  const issues: string[] = [];
  if (!config.primaryTable) issues.push('Select at least one table to query.');
  if (config.limit !== null && config.limit <= 0) issues.push('Result limit must be a positive number.');
  const aliasSeen = new Set<string>();
  config.columns.forEach((c) => {
    if (c.alias) {
      if (aliasSeen.has(c.alias)) issues.push(`Duplicate alias "${c.alias}" — aliases must be unique.`);
      aliasSeen.add(c.alias);
    }
  });
  config.filters.forEach((f, idx) => {
    if (!['IS NULL', 'IS NOT NULL'].includes(f.operator) && f.value.trim() === '') {
      issues.push(`Filter #${idx + 1} on ${f.table}.${f.column} needs a value.`);
    }
  });
  return issues;
}

export function validateCr(config: CrQueryConfig): string[] {
  const issues: string[] = [];
  if (!config.table) issues.push('Select a table for this Change Request.');
  if (config.queryType !== 'DELETE' && config.values.length === 0) {
    issues.push('Add at least one column/value pair.');
  }
  if ((config.queryType === 'UPDATE' || config.queryType === 'DELETE') && config.filters.length === 0 && !config.confirmNoWhere) {
    issues.push('A WHERE condition is required — add a filter or explicitly confirm no WHERE condition.');
  }
  return issues;
}
