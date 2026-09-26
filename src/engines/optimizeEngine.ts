import type { ReadOnlyQueryState } from '../types';
export function optimizeSuggestions(state: ReadOnlyQueryState): string[] {
  const tips: string[] = [];
  if (state.selectedColumns.length === 0) tips.push('You are selecting every column (SELECT *). List only the columns you need to reduce network and memory cost.');
  state.filters.filter((f) => f.operator === 'LIKE' || f.operator === 'NOT LIKE').forEach((f) => { if (f.value.trim().startsWith('%')) tips.push(`The LIKE filter on ${f.table}.${f.column} starts with "%", which prevents an index range scan. Consider a suffix-only wildcard if possible.`); });
  if ((state.joins.length + state.selectedTables.length - 1) >= 2 && state.filters.length === 0) tips.push('Multiple joins with no WHERE filter can return very large result sets — consider adding a filter to narrow the rows scanned.');
  if (state.advanced.limit === null && state.sorts.length === 0) tips.push('No result limit or ORDER BY is set. For exploratory queries against large tables, add a LIMIT / TOP / FETCH FIRST to keep results manageable.');
  if (state.filters.some((f) => f.operator === 'IN' && f.value.split(',').length > 50)) tips.push('One of your IN filters has a large number of literal values — consider a temporary lookup table or EXISTS-based rewrite for large lists.');
  if (state.advanced.recursive) tips.push('Recursive hierarchy walks can be expensive on deep trees — ensure the anchor filter is selective and add a depth guard if the hierarchy could cycle.');
  if (state.advanced.groupByColumns.length > 0 && !state.advanced.havingClause.trim() && state.selectedColumns.some((c) => c.aggregate)) tips.push('You are aggregating with GROUP BY but have no HAVING clause — add one if you need to filter on the aggregate result.');
  if (tips.length === 0) tips.push('No obvious optimization issues detected for this query shape. Review the execution plan on your target database for final confirmation.');
  return tips;
}
