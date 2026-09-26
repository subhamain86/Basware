import type { SchemaModel, TableDef, SchemaIntegrityResult, SchemaIntegrityIssue } from '../types';
import { VALID_DATA_TYPES } from '../types';

// ============================================================================
// schemaIntegrityEngine — validates a full candidate table list (as it would
// look AFTER a pending Manual Schema Editor change is applied) before that
// change is committed. Used to implement the "transactional-style" apply
// pattern: Current Schema -> Pending Changes -> Validation -> Apply. If
// validation fails, the caller must NOT persist the pending change, so the
// current schema remains unchanged.
// ============================================================================

export function validateSchemaIntegrity(tables: TableDef[]): SchemaIntegrityResult {
  const issues: SchemaIntegrityIssue[] = [];
  const seenTableColumn = new Set<string>();
  const tableNames = new Set(tables.map((t) => t.name.trim().toUpperCase()));

  tables.forEach((t) => {
    if (!t.name || !t.name.trim()) { issues.push({ severity: 'error', message: 'A table is missing its Table Name.' }); return; }
    if (t.columns.length === 0) { issues.push({ severity: 'warning', message: `Table "${t.name}" has no columns defined.` }); }

    let pkCount = 0;
    t.columns.forEach((c) => {
      if (!c.name || !c.name.trim()) { issues.push({ severity: 'error', message: `Table "${t.name}" has a column with a missing Column Name.` }); return; }

      const key = `${t.name.trim().toUpperCase()}::${c.name.trim().toUpperCase()}`;
      if (seenTableColumn.has(key)) issues.push({ severity: 'error', message: `Duplicate column "${t.name}.${c.name}" — each table/column combination must be unique.` });
      seenTableColumn.add(key);

      if (!VALID_DATA_TYPES.includes(c.type)) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" has an invalid data type "${c.type}". Must be one of: ${VALID_DATA_TYPES.join(', ')}.` });

      if (c.isPrimaryKey) pkCount += 1;

      if (c.isForeignKey) {
        if (!c.references || !c.references.table || !c.references.column) {
          issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" is marked as a Foreign Key but has no reference table/column.` });
        } else {
          const refTableName = c.references.table.trim().toUpperCase();
          if (!tableNames.has(refTableName)) {
            issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" references table "${c.references.table}", which does not exist in this schema.` });
          } else {
            const refTable = tables.find((rt) => rt.name.trim().toUpperCase() === refTableName);
            const refColExists = refTable?.columns.some((rc) => rc.name.trim().toUpperCase() === c.references!.column.trim().toUpperCase());
            if (!refColExists) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" references "${c.references.table}.${c.references.column}", which does not exist.` });
          }
        }
      }

      if (c.decode) {
        const seenRaw = new Set<string>();
        c.decode.forEach((d) => {
          if (!d.rawValue.trim()) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" has a decode entry with an empty raw value.` });
          const rk = d.rawValue.trim().toUpperCase();
          if (rk && seenRaw.has(rk)) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" has duplicate decode raw value "${d.rawValue}".` });
          seenRaw.add(rk);
        });
      }

      if (c.length !== undefined && c.length !== null && c.length < 0) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" has a negative Length.` });
      if (c.precision !== undefined && c.precision !== null && c.precision < 0) issues.push({ severity: 'error', message: `Column "${t.name}.${c.name}" has a negative Precision.` });
    });

    if (pkCount > 1) issues.push({ severity: 'warning', message: `Table "${t.name}" has ${pkCount} primary-key columns (composite key) — confirm this is intentional.` });
    if (pkCount === 0 && t.columns.length > 0) issues.push({ severity: 'warning', message: `Table "${t.name}" has no primary key defined.` });
  });

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, issues };
}

/** Validates a single proposed row (used for immediate inline feedback in the
 * Add/Edit Row form) against the rest of the schema, without needing the
 * caller to construct a full candidate table list. */
export function validateSingleRowAgainstSchema(
  schema: SchemaModel,
  tableName: string,
  columnName: string,
  originalTableName: string | null,
  originalColumnName: string | null
): SchemaIntegrityIssue[] {
  const issues: SchemaIntegrityIssue[] = [];
  if (!tableName.trim()) issues.push({ severity: 'error', message: 'Table Name is required.' });
  if (!columnName.trim()) issues.push({ severity: 'error', message: 'Column Name is required.' });
  if (!tableName.trim() || !columnName.trim()) return issues;

  const isSameAsOriginal = originalTableName?.toUpperCase() === tableName.trim().toUpperCase() && originalColumnName?.toUpperCase() === columnName.trim().toUpperCase();
  if (isSameAsOriginal) return issues;

  const table = schema.tables.find((t) => t.name.trim().toUpperCase() === tableName.trim().toUpperCase());
  const clash = table?.columns.some((c) => c.name.trim().toUpperCase() === columnName.trim().toUpperCase());
  if (clash) issues.push({ severity: 'error', message: `Column "${tableName}.${columnName}" already exists in this schema.` });

  return issues;
}
