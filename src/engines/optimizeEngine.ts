import type { ReadOnlyQueryConfig } from '../types';

// optimize-engine.ts — SQL Optimization Advisor (rule-based, static analysis).

export function optimizeSuggestions(config: ReadOnlyQueryConfig): string[] {
  const tips: string[] = [];

  if (config.columns.length === 0) {
    tips.push('You are selecting every column (SELECT *). List only the columns you need to reduce network and memory cost.');
  }

  const likeFilters = config.filters.filter((f) => f.operator === 'LIKE' || f.operator === 'NOT LIKE');
  likeFilters.forEach((f) => {
    if (f.value.trim().startsWith('%')) {
      tips.push(`The LIKE filter on ${f.table}.${f.column} starts with "%", which prevents an index range scan. Consider a suffix-only wildcard if possible.`);
    }
  });

  if (config.joins.length >= 2 && config.filters.length === 0) {
    tips.push('Multiple joins with no WHERE filter can return very large result sets — consider adding a filter to narrow the rows scanned.');
  }

  if (config.limit === null && config.sorts.length === 0) {
    tips.push('No result limit or ORDER BY is set. For exploratory queries against large tables, add a LIMIT / TOP / FETCH FIRST to keep results manageable.');
  }

  if (config.filters.some((f) => f.operator === 'IN' && f.value.split(',').length > 50)) {
    tips.push('One of your IN filters has a large number of literal values — consider a temporary lookup table or EXISTS-based rewrite for large lists.');
  }

  if (config.recursive) {
    tips.push('Recursive hierarchy walks can be expensive on deep trees — ensure the anchor filter is selective and add a depth guard if the hierarchy could cycle.');
  }

  if (tips.length === 0) {
    tips.push('No obvious optimization issues detected for this query shape. Review execution plan on your target database for final confirmation.');
  }

  return tips;
}
