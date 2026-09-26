import type { SchemaModel } from '../types';

// Default embedded AP/P2P schema — used until superseded by an imported schema.
export const DEFAULT_SCHEMA: SchemaModel = {
  version: '12.0',
  updatedAt: new Date().toISOString(),
  tables: [
    {
      name: 'PO_HEADER',
      module: 'Purchase Orders',
      description: 'One row per purchase order.',
      columns: [
        { name: 'PO_ID', label: 'PO ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'VENDOR_ID', label: 'Vendor ID', type: 'NUMBER', nullable: false, fk: { table: 'VENDOR', column: 'VENDOR_ID' }, description: 'Vendor on the PO.' },
        { name: 'BUYER_ID', label: 'Buyer ID', type: 'NUMBER', nullable: true, fk: { table: 'APP_USER', column: 'USER_ID' }, description: 'User who created the PO.' },
        { name: 'PO_DATE', label: 'PO Date', type: 'DATE', nullable: false, description: 'Date the PO was raised.' },
        { name: 'STATUS', label: 'Status', type: 'VARCHAR', length: 1, nullable: false, decode: { O: 'Open', C: 'Closed', H: 'On Hold' }, description: 'PO lifecycle status.' },
        { name: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'NUMBER', nullable: false, description: 'PO total value.' },
        { name: 'CURRENCY', label: 'Currency', type: 'VARCHAR', length: 3, nullable: false, description: 'ISO currency code.' }
      ]
    },
    {
      name: 'PO_LINE',
      module: 'Purchase Orders',
      description: 'Line items belonging to a purchase order.',
      columns: [
        { name: 'LINE_ID', label: 'Line ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'PO_ID', label: 'PO ID', type: 'NUMBER', nullable: false, fk: { table: 'PO_HEADER', column: 'PO_ID' }, description: 'Parent PO.' },
        { name: 'LINE_NO', label: 'Line No', type: 'NUMBER', nullable: false, description: 'Sequence within the PO.' },
        { name: 'ITEM_DESCRIPTION', label: 'Item Description', type: 'VARCHAR', length: 240, nullable: true, description: 'Free-text item description.' },
        { name: 'QTY', label: 'Quantity', type: 'NUMBER', nullable: false, description: 'Ordered quantity.' },
        { name: 'UNIT_PRICE', label: 'Unit Price', type: 'NUMBER', nullable: false, description: 'Price per unit.' },
        { name: 'GL_ACCOUNT_ID', label: 'GL Account ID', type: 'NUMBER', nullable: true, fk: { table: 'GL_ACCOUNT', column: 'ACCOUNT_ID' }, description: 'Cost allocation account.' }
      ]
    },
    {
      name: 'INVOICE_HEADER',
      module: 'Invoices',
      description: 'One row per supplier invoice.',
      columns: [
        { name: 'INVOICE_ID', label: 'Invoice ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'VENDOR_ID', label: 'Vendor ID', type: 'NUMBER', nullable: false, fk: { table: 'VENDOR', column: 'VENDOR_ID' }, description: 'Vendor who issued the invoice.' },
        { name: 'PO_ID', label: 'PO ID', type: 'NUMBER', nullable: true, fk: { table: 'PO_HEADER', column: 'PO_ID' }, description: 'Matched purchase order, if any.' },
        { name: 'INVOICE_DATE', label: 'Invoice Date', type: 'DATE', nullable: false, description: 'Date on the invoice document.' },
        { name: 'BASE_DATE', label: 'Base Date', type: 'DATE', nullable: true, description: 'Date used as the basis for due-date calculation.' },
        { name: 'DUE_DATE', label: 'Due Date', type: 'DATE', nullable: true, description: 'Date the invoice is due for payment.' },
        { name: 'STATUS', label: 'Status', type: 'VARCHAR', length: 1, nullable: false, decode: { P: 'Pending', A: 'Approved', R: 'Rejected', D: 'Paid' }, description: 'Invoice lifecycle status.' },
        { name: 'TOTAL_AMOUNT', label: 'Total Amount', type: 'NUMBER', nullable: false, description: 'Invoice total value.' },
        { name: 'CURRENCY', label: 'Currency', type: 'VARCHAR', length: 3, nullable: false, description: 'ISO currency code.' }
      ]
    },
    {
      name: 'INVOICE_LINE',
      module: 'Invoices',
      description: 'Line items belonging to a supplier invoice.',
      columns: [
        { name: 'LINE_ID', label: 'Line ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'INVOICE_ID', label: 'Invoice ID', type: 'NUMBER', nullable: false, fk: { table: 'INVOICE_HEADER', column: 'INVOICE_ID' }, description: 'Parent invoice.' },
        { name: 'LINE_NO', label: 'Line No', type: 'NUMBER', nullable: false, description: 'Sequence within the invoice.' },
        { name: 'DESCRIPTION', label: 'Description', type: 'VARCHAR', length: 240, nullable: true, description: 'Free-text line description.' },
        { name: 'AMOUNT', label: 'Amount', type: 'NUMBER', nullable: false, description: 'Line amount.' },
        { name: 'GL_ACCOUNT_ID', label: 'GL Account ID', type: 'NUMBER', nullable: true, fk: { table: 'GL_ACCOUNT', column: 'ACCOUNT_ID' }, description: 'Cost allocation account.' }
      ]
    },
    {
      name: 'VENDOR',
      module: 'Vendors',
      description: 'Supplier / vendor master data.',
      columns: [
        { name: 'VENDOR_ID', label: 'Vendor ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'VENDOR_NAME', label: 'Vendor Name', type: 'VARCHAR', length: 120, nullable: false, description: 'Legal or trading name.' },
        { name: 'DUNS_NUMBER', label: 'DUNS Number', type: 'VARCHAR', length: 15, nullable: true, description: 'D-U-N-S identifier.' },
        { name: 'COUNTRY', label: 'Country', type: 'VARCHAR', length: 2, nullable: false, description: 'ISO country code.' },
        { name: 'STATUS', label: 'Status', type: 'VARCHAR', length: 1, nullable: false, decode: { A: 'Active', I: 'Inactive' }, description: 'Vendor account status.' },
        { name: 'PAYMENT_TERMS', label: 'Payment Terms', type: 'VARCHAR', length: 20, nullable: true, description: 'Standard payment terms code.' }
      ]
    },
    {
      name: 'GL_ACCOUNT',
      module: 'General Ledger',
      description: 'Chart of accounts.',
      columns: [
        { name: 'ACCOUNT_ID', label: 'Account ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'ACCOUNT_NAME', label: 'Account Name', type: 'VARCHAR', length: 120, nullable: false, description: 'Account description.' },
        { name: 'ACCOUNT_TYPE', label: 'Account Type', type: 'VARCHAR', length: 1, nullable: false, decode: { E: 'Expense', A: 'Asset', L: 'Liability', R: 'Revenue' }, description: 'Account classification.' },
        { name: 'COST_CENTER', label: 'Cost Center', type: 'VARCHAR', length: 20, nullable: true, description: 'Owning cost center.' }
      ]
    },
    {
      name: 'APP_USER',
      module: 'Users & Approvals',
      description: 'Application user directory.',
      columns: [
        { name: 'USER_ID', label: 'User ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'FULL_NAME', label: 'Full Name', type: 'VARCHAR', length: 120, nullable: false, description: 'Display name.' },
        { name: 'EMAIL', label: 'Email', type: 'VARCHAR', length: 160, nullable: false, description: 'Login / contact email.' },
        { name: 'ROLE', label: 'Role', type: 'VARCHAR', length: 2, nullable: false, decode: { A: 'Admin', S: 'Support', B: 'Buyer', AP: 'AP Clerk' }, description: 'Assigned application role.' },
        { name: 'ACTIVE_FLAG', label: 'Active', type: 'FLAG', nullable: false, decode: { Y: 'Yes', N: 'No' }, description: 'Whether the account is active.' }
      ]
    },
    {
      name: 'APPROVAL_HISTORY',
      module: 'Users & Approvals',
      description: 'Audit trail of invoice approval actions.',
      columns: [
        { name: 'APPROVAL_ID', label: 'Approval ID', type: 'NUMBER', nullable: false, pk: true, description: 'Primary key.' },
        { name: 'INVOICE_ID', label: 'Invoice ID', type: 'NUMBER', nullable: false, fk: { table: 'INVOICE_HEADER', column: 'INVOICE_ID' }, description: 'Invoice being actioned.' },
        { name: 'APPROVER_ID', label: 'Approver ID', type: 'NUMBER', nullable: false, fk: { table: 'APP_USER', column: 'USER_ID' }, description: 'User who took the action.' },
        { name: 'APPROVAL_DATE', label: 'Approval Date', type: 'DATE', nullable: false, description: 'Date/time of the action.' },
        { name: 'ACTION', label: 'Action', type: 'VARCHAR', length: 3, nullable: false, decode: { APP: 'Approved', REJ: 'Rejected', ESC: 'Escalated' }, description: 'Action taken.' }
      ]
    }
  ]
};

export const SCHEMA_STORAGE_KEY = 'apsql.schema.v12';
export const DEMO_SCHEMA_PASSWORD = 'apsql-admin';

export function loadSchema(): SchemaModel {
  try {
    const raw = localStorage.getItem(SCHEMA_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SchemaModel;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_SCHEMA;
}

export function saveSchema(schema: SchemaModel): void {
  localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(schema));
}

export function resetSchema(): SchemaModel {
  localStorage.removeItem(SCHEMA_STORAGE_KEY);
  return DEFAULT_SCHEMA;
}
