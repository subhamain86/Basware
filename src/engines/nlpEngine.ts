import type { SchemaModel, QueryRequirement, SelectedColumnSpec, FilterCondition, SortSpec, ColumnDef, TableDef } from '../types';
import { makeId } from '../utils/id';
interface ColumnRef { table: string; column: ColumnDef; }
function allColumns(schema: SchemaModel): ColumnRef[] { return schema.tables.flatMap((t) => t.columns.map((c) => ({ table: t.name, column: c }))); }
function findTableMentions(text: string, schema: SchemaModel): TableDef[] {
  const upper = text.toUpperCase(); const found: TableDef[] = [];
  for (const t of schema.tables) {
    const spaced = t.name.replace(/_/g, ' '); const singularish = spaced.replace(/S$/, '');
    if (upper.includes(t.name) || upper.includes(spaced) || upper.includes(singularish)) found.push(t);
  }
  const ALIASES: Record<string, string> = { INVOICE: 'INVOICE_HEADER', INVOICES: 'INVOICE_HEADER', 'PURCHASE ORDER': 'PO_HEADER', 'PURCHASE ORDERS': 'PO_HEADER', PO: 'PO_HEADER', VENDOR: 'VENDOR', VENDORS: 'VENDOR', SUPPLIER: 'VENDOR', SUPPLIERS: 'VENDOR', 'GL ACCOUNT': 'GL_ACCOUNT', ACCOUNT: 'GL_ACCOUNT', ACCOUNTS: 'GL_ACCOUNT', USER: 'APP_USER', USERS: 'APP_USER', APPROVAL: 'APPROVAL_HISTORY', APPROVALS: 'APPROVAL_HISTORY' };
  Object.entries(ALIASES).forEach(([alias, tableName]) => { if (upper.includes(alias) && schema.tables.some((t) => t.name === tableName) && !found.some((f) => f.name === tableName)) found.push(schema.tables.find((t) => t.name === tableName)!); });
  return found;
}
function findColumnMentions(text: string, tables: TableDef[]): ColumnRef[] {
  const upper = text.toUpperCase(); const cols: ColumnRef[] = [];
  const pool = tables.length ? tables.flatMap((t) => t.columns.map((c) => ({ table: t.name, column: c }))) : [];
  for (const ref of pool) { const nameSpaced = ref.column.name.replace(/_/g, ' '); const labelUpper = ref.column.label.toUpperCase(); if (upper.includes(ref.column.name) || upper.includes(nameSpaced) || upper.includes(labelUpper)) cols.push(ref); }
  return cols;
}
interface ComparisonPhrase { pattern: RegExp; operator: FilterCondition['operator']; }
const COMPARISON_PHRASES: ComparisonPhrase[] = [
  { pattern: /greater than or equal to|at least|no less than|>=/, operator: '>=' },
  { pattern: /less than or equal to|at most|no more than|<=/, operator: '<=' },
  { pattern: /greater than|more than|above|over|exceed(?:s|ing)?/, operator: '>' },
  { pattern: /less than|below|under/, operator: '<' },
  { pattern: /not equal to|different from|<>/, operator: '<>' },
  { pattern: /equal to|equals|is exactly|=/, operator: '=' }
];
function extractNumericFilters(text: string, columns: ColumnRef[]): FilterCondition[] {
  const filters: FilterCondition[] = []; const numericCols = columns.filter((c) => c.column.type === 'NUMBER'); const lower = text.toLowerCase();
  numericCols.forEach((ref) => {
    const labelVariants = [ref.column.name.toLowerCase(), ref.column.label.toLowerCase(), ref.column.name.replace(/_/g, ' ').toLowerCase()];
    for (const variant of labelVariants) {
      const idx = lower.indexOf(variant); if (idx === -1) continue;
      const windowText = lower.slice(idx, idx + 80);
      for (const cmp of COMPARISON_PHRASES) {
        const cmpMatch = windowText.match(cmp.pattern);
        if (cmpMatch) { const afterCmp = windowText.slice(cmpMatch.index || 0); const numMatch = afterCmp.match(/-?\d[\d,]*(\.\d+)?/); if (numMatch) { filters.push({ id: makeId('filt'), table: ref.table, column: ref.column.name, operator: cmp.operator, combinator: 'AND', value: numMatch[0].replace(/,/g, '') }); break; } }
      }
      break;
    }
  });
  return filters;
}
function extractDateFilters(text: string, tables: TableDef[]): FilterCondition[] {
  const lower = text.toLowerCase(); const filters: FilterCondition[] = [];
  const relMatch = lower.match(/last\s+(\d+)\s*(day|days|week|weeks|month|months|year|years)/); if (!relMatch) return filters;
  const amount = parseInt(relMatch[1], 10); const unit = relMatch[2].startsWith('day') ? 'DAY' : relMatch[2].startsWith('week') ? 'WEEK' : relMatch[2].startsWith('month') ? 'MONTH' : 'YEAR';
  const dateCols = tables.flatMap((t) => t.columns.filter((c) => c.type === 'DATE').map((c) => ({ table: t.name, column: c }))); if (dateCols.length === 0) return filters;
  const preferred = dateCols.find((d) => /created|invoice_date|po_date/i.test(d.column.name)) || dateCols[0];
  filters.push({ id: makeId('filt'), table: preferred.table, column: preferred.column.name, operator: '>=', combinator: 'AND', value: `CURRENT_DATE - INTERVAL '${amount} ${unit}'` });
  return filters;
}
function extractDecodeFilters(text: string, tables: TableDef[]): FilterCondition[] {
  const upper = text.toUpperCase(); const filters: FilterCondition[] = [];
  const decodeCols = tables.flatMap((t) => t.columns.filter((c) => c.decode && c.decode.length > 0).map((c) => ({ table: t.name, column: c })));
  decodeCols.forEach((ref) => { ref.column.decode!.forEach((d) => { if (upper.includes(d.label.toUpperCase())) filters.push({ id: makeId('filt'), table: ref.table, column: ref.column.name, operator: '=', combinator: 'AND', value: d.rawValue }); }); });
  return filters;
}
function extractLimit(text: string): number | null { const m = text.match(/\b(?:top|first|limit)\s+(\d+)/i); return m ? parseInt(m[1], 10) : null; }
function extractDistinct(text: string): boolean { return /\bdistinct\b|\bunique\b/i.test(text); }
function extractSorts(text: string, tables: TableDef[]): SortSpec[] {
  const m = text.match(/sort(?:ed)?\s+by\s+([a-z0-9_ ]+?)(?:\s+(ascending|asc|descending|desc))?(?:[.,]|$)/i); if (!m) return [];
  const phrase = m[1].trim().toLowerCase(); const direction: SortSpec['direction'] = /desc/i.test(m[2] || '') ? 'DESC' : 'ASC';
  for (const t of tables) for (const c of t.columns) if (phrase.includes(c.name.toLowerCase()) || phrase.includes(c.label.toLowerCase())) return [{ id: makeId('sort'), table: t.name, column: c.name, direction }];
  return [];
}
export function parseRequirement(rawText: string, schema: SchemaModel): QueryRequirement {
  const notes: string[] = []; const text = rawText.trim();
  if (!text) return { rawText, matchedTables: [], matchedColumns: [], matchedFilters: [], matchedSorts: [], limit: null, distinct: false, confidence: 0, notes: ['No requirement text was provided.'] };
  const tables = findTableMentions(text, schema);
  if (tables.length === 0) { notes.push('No table names were recognized in the active schema — try mentioning a business object like "invoice", "purchase order", or "vendor".'); return { rawText, matchedTables: [], matchedColumns: [], matchedFilters: [], matchedSorts: [], limit: null, distinct: false, confidence: 0.1, notes }; }
  notes.push(`Recognized table(s): ${tables.map((t) => t.name).join(', ')}.`);
  const mentionedColumns = findColumnMentions(text, tables);
  const numericFilters = extractNumericFilters(text, mentionedColumns.length ? mentionedColumns : allColumns(schema).filter((c) => tables.some((t) => t.name === c.table)));
  const dateFilters = extractDateFilters(text, tables); const decodeFilters = extractDecodeFilters(text, tables);
  const allFilters = [...numericFilters, ...dateFilters, ...decodeFilters];
  if (allFilters.length) notes.push(`Inferred ${allFilters.length} filter condition(s) from the text.`); else notes.push('No explicit filter conditions were recognized — showing all rows for the matched table(s).');
  const limit = extractLimit(text); if (limit) notes.push(`Result limit of ${limit} detected ("top/first/limit ${limit}").`);
  const distinct = extractDistinct(text); if (distinct) notes.push('DISTINCT requested.');
  const sorts = extractSorts(text, tables); if (sorts.length) notes.push(`Sort by ${sorts[0].table}.${sorts[0].column} ${sorts[0].direction}.`);
  let selectedColumns: SelectedColumnSpec[] = mentionedColumns.map((c) => ({ id: makeId('col'), table: c.table, column: c.column.name, alias: '', useDecode: !!c.column.decode?.length, aggregate: null }));
  if (selectedColumns.length === 0) { tables.forEach((t) => { const defaultCols = t.columns.filter((c) => c.isPrimaryKey || /date|amount|name|status/i.test(c.name)).slice(0, 5); defaultCols.forEach((c) => selectedColumns.push({ id: makeId('col'), table: t.name, column: c.name, alias: '', useDecode: !!c.decode?.length, aggregate: null })); }); notes.push('No specific columns mentioned — defaulted to key identifying columns for the matched table(s).'); }
  const confidence = Math.min(1, 0.35 + tables.length * 0.15 + allFilters.length * 0.15 + (selectedColumns.length ? 0.15 : 0));
  return { rawText, matchedTables: tables.map((t) => t.name), matchedColumns: selectedColumns, matchedFilters: allFilters, matchedSorts: sorts, limit, distinct, confidence, notes };
}
