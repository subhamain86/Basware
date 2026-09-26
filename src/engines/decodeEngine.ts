import type { ColumnDef, Dialect } from '../types';

// decode-engine.ts — schema-driven decode/CASE resolution.

export function buildDecodeExpression(col: ColumnDef, tableName: string, dialect: Dialect, alias?: string): string {
  const fq = `${tableName}.${col.name}`;
  if (!col.decode) return fq;
  const entries = Object.entries(col.decode);
  const finalAlias = alias || `${col.name}_DESC`;

  if (dialect === 'Oracle') {
    const args = entries.map(([raw, label]) => `'${raw}', '${label.replace(/'/g, "''")}'`).join(', ');
    return `DECODE(${fq}, ${args}, ${fq}) AS ${finalAlias}`;
  }

  const whens = entries
    .map(([raw, label]) => `    WHEN ${fq} = '${raw}' THEN '${label.replace(/'/g, "''")}'`)
    .join('\n');
  return `CASE\n${whens}\n    ELSE ${fq}\n  END AS ${finalAlias}`;
}

export function decodeLegend(col: ColumnDef): string {
  if (!col.decode) return '';
  return Object.entries(col.decode)
    .map(([raw, label]) => `${raw} = ${label}`)
    .join(', ');
}
