// Sample finance data. Deterministic — never regenerated.

const SnowyData = {
  projects: [
    { id: 'ledger', name: 'Ledger Core', color: 'oklch(0.62 0.17 240)', connections: [
      { id: 'prod', name: 'production', host: 'prod-db.internal', env: 'prod', status: 'online', db: 'ledger_prod' },
      { id: 'dev',  name: 'development', host: 'dev-db.internal', env: 'dev', status: 'online', db: 'ledger_dev' },
      { id: 'local', name: 'localhost', host: '127.0.0.1', env: 'local', status: 'online', db: 'ledger_local' },
    ]},
    { id: 'risk', name: 'Risk Analytics', color: 'oklch(0.62 0.17 320)', connections: [
      { id: 'prod', name: 'production', host: 'risk-prod.internal', env: 'prod', status: 'online', db: 'risk' },
      { id: 'staging', name: 'staging', host: 'risk-stg.internal', env: 'stg', status: 'online', db: 'risk_stg' },
    ]},
    { id: 'wh', name: 'Warehouse', color: 'oklch(0.60 0.14 155)', connections: [
      { id: 'prod', name: 'snowflake-sync', host: 'wh-replica.internal', env: 'prod', status: 'offline', db: 'warehouse' },
    ]},
  ],

  // ledger_prod schema tree
  schemas: [
    { name: 'public', tables: [
      { name: 'accounts', rows: '1.24M', cols: 12, pk: 'id' },
      { name: 'transactions', rows: '84.3M', cols: 18, pk: 'id', hot: true },
      { name: 'ledger_entries', rows: '168.7M', cols: 9, pk: 'id', hot: true },
      { name: 'journals', rows: '42.1M', cols: 7, pk: 'id' },
      { name: 'counterparties', rows: '8.9K', cols: 14, pk: 'id' },
      { name: 'positions', rows: '3.2M', cols: 11, pk: 'id' },
      { name: 'fx_rates', rows: '421K', cols: 6, pk: 'id' },
      { name: 'settlements', rows: '12.4M', cols: 15, pk: 'id' },
      { name: 'holdings', rows: '892K', cols: 10, pk: 'id' },
      { name: 'instruments', rows: '48.2K', cols: 22, pk: 'id' },
      { name: 'audit_log', rows: '312M', cols: 8, pk: 'id' },
    ]},
    { name: 'finance', tables: [
      { name: 'reconciliations', rows: '1.8M', cols: 14, pk: 'id' },
      { name: 'gl_accounts', rows: '18.4K', cols: 9, pk: 'id' },
      { name: 'trial_balance_mv', rows: '224K', cols: 7, pk: 'date,account', mat: true },
      { name: 'daily_pnl_mv', rows: '12.4K', cols: 11, pk: 'date', mat: true },
    ]},
    { name: 'compliance', tables: [
      { name: 'kyc_records', rows: '892K', cols: 24, pk: 'id' },
      { name: 'sanctions_hits', rows: '4.2K', cols: 12, pk: 'id' },
      { name: 'audit_trail', rows: '92.1M', cols: 6, pk: 'id' },
    ]},
    { name: 'reporting', tables: [] },
    { name: 'analytics', tables: [] },
  ],

  // transactions columns
  txnCols: [
    { name: 'id', type: 'uuid', pk: true },
    { name: 'posted_at', type: 'timestamptz', idx: true },
    { name: 'account_id', type: 'uuid', fk: true, idx: true },
    { name: 'counterparty_id', type: 'uuid', fk: true },
    { name: 'amount', type: 'numeric(20,4)' },
    { name: 'currency', type: 'char(3)' },
    { name: 'direction', type: 'txn_dir' },
    { name: 'status', type: 'txn_status', idx: true },
    { name: 'reference', type: 'text' },
    { name: 'memo', type: 'text' },
    { name: 'fx_rate', type: 'numeric(14,8)' },
    { name: 'fee', type: 'numeric(14,4)' },
    { name: 'settled_at', type: 'timestamptz' },
    { name: 'metadata', type: 'jsonb' },
  ],

  // sample rows
  txnRows: [
    { id: '7a3e9f2c', posted: '2026-04-21 14:22:08.112', account: 'acc_0x41ab…c09', cpty: 'Stripe Inc.', amount: '+128,440.00', ccy: 'USD', dir: 'credit', status: 'posted', ref: 'INV-90421', memo: 'Settlement — Apr wk 3', fx: '1.00000000', fee: '0.0000' },
    { id: 'f801b4a2', posted: '2026-04-21 14:21:55.004', account: 'acc_0x41ab…c09', cpty: 'AWS', amount: '−14,208.32', ccy: 'USD', dir: 'debit', status: 'posted', ref: 'AWS-APR-26', memo: 'Infra — production', fx: '1.00000000', fee: '0.0000' },
    { id: '2c91e07d', posted: '2026-04-21 14:21:41.788', account: 'acc_0x8e2f…a14', cpty: 'Deutsche Bank', amount: '+2,400,000.00', ccy: 'EUR', dir: 'credit', status: 'pending', ref: 'WIRE-DE-8841', memo: 'Funding — Series C tranche 2', fx: '1.08420000', fee: '12.5000' },
    { id: 'b4f2a109', posted: '2026-04-21 14:21:12.220', account: 'acc_0x8e2f…a14', cpty: 'Revolut Ltd.', amount: '−892.40', ccy: 'GBP', dir: 'debit', status: 'posted', ref: 'CARD-3492', memo: 'Corp travel', fx: '1.26200000', fee: '0.0000' },
    { id: '9e08d3cc', posted: '2026-04-21 14:20:58.900', account: 'acc_0x12fa…d81', cpty: 'Plaid', amount: '+84,004.00', ccy: 'USD', dir: 'credit', status: 'posted', ref: 'ACH-P-71204', memo: 'Batch deposit', fx: '1.00000000', fee: '0.0000' },
    { id: '3ac47e11', posted: '2026-04-21 14:20:22.411', account: 'acc_0x12fa…d81', cpty: 'Wise', amount: '−48,920.00', ccy: 'EUR', dir: 'debit', status: 'reversed', ref: 'WISE-4481', memo: 'Vendor — Acme GmbH', fx: '1.08420000', fee: '9.2400' },
    { id: 'ec10f0b7', posted: '2026-04-21 14:19:44.002', account: 'acc_0x41ab…c09', cpty: 'Adyen', amount: '+8,241.18', ccy: 'USD', dir: 'credit', status: 'posted', ref: 'ADY-88122', memo: 'Card payout', fx: '1.00000000', fee: '0.0000' },
    { id: '5d2eb3a4', posted: '2026-04-21 14:19:08.338', account: 'acc_0x12fa…d81', cpty: 'GitHub', amount: '−2,100.00', ccy: 'USD', dir: 'debit', status: 'posted', ref: 'GH-ENT-26', memo: 'Licenses — enterprise', fx: '1.00000000', fee: '0.0000' },
    { id: 'a7c9f04e', posted: '2026-04-21 14:18:55.101', account: 'acc_0x8e2f…a14', cpty: 'Citibank', amount: '+1,000,000.00', ccy: 'USD', dir: 'credit', status: 'posted', ref: 'FED-WIRE-0482', memo: 'Overnight sweep return', fx: '1.00000000', fee: '0.0000' },
    { id: '1b04f8ea', posted: '2026-04-21 14:18:41.290', account: 'acc_0x41ab…c09', cpty: 'Linear', amount: '−680.00', ccy: 'USD', dir: 'debit', status: 'posted', ref: 'LIN-APR', memo: 'Tooling', fx: '1.00000000', fee: '0.0000' },
    { id: '6f39bd21', posted: '2026-04-21 14:18:12.018', account: 'acc_0xb82c…f44', cpty: 'HSBC', amount: '+320,000.00', ccy: 'HKD', dir: 'credit', status: 'posted', ref: 'HSBC-HK-9201', memo: 'APAC entity funding', fx: '0.12820000', fee: '8.0000' },
    { id: 'd09a14c7', posted: '2026-04-21 14:17:58.492', account: 'acc_0xb82c…f44', cpty: 'DBS Singapore', amount: '−19,400.00', ccy: 'SGD', dir: 'debit', status: 'failed', ref: 'DBS-81102', memo: 'Local payroll batch', fx: '0.73800000', fee: '0.0000' },
    { id: '8e72aa03', posted: '2026-04-21 14:17:22.209', account: 'acc_0x41ab…c09', cpty: 'Brex', amount: '−4,912.55', ccy: 'USD', dir: 'debit', status: 'posted', ref: 'BREX-3312', memo: 'Corp card reimbursement', fx: '1.00000000', fee: '0.0000' },
    { id: '2f84c811', posted: '2026-04-21 14:17:04.883', account: 'acc_0x12fa…d81', cpty: 'Modern Treasury', amount: '+244,801.12', ccy: 'USD', dir: 'credit', status: 'posted', ref: 'MT-BATCH-021', memo: 'ACH collections — weekly', fx: '1.00000000', fee: '0.0000' },
  ],

  queries: [
    { id: 'q1', name: 'Daily P&L by desk', ran: '2m ago', rows: 12, ms: 142, pinned: true },
    { id: 'q2', name: 'Stuck settlements > 24h', ran: '14m ago', rows: 38, ms: 880, pinned: true },
    { id: 'q3', name: 'Top counterparties (30d)', ran: '1h ago', rows: 50, ms: 1280 },
    { id: 'q4', name: 'FX exposure by ccy', ran: '3h ago', rows: 18, ms: 412, pinned: true },
    { id: 'q5', name: 'Audit: admin writes', ran: 'yesterday', rows: 204, ms: 2012 },
    { id: 'q6', name: 'Reconciliation breaks', ran: 'yesterday', rows: 7, ms: 340, pinned: true },
  ],
};

Object.assign(window, { SnowyData });
