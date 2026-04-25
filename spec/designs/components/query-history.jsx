// Query history screen — chronological list with query preview panel.

function QueryHistory({ theme }) {
  const t = theme;
  const history = [
    { id: 'h1', when: '2m ago', conn: 'production', sql: 'SELECT desk, sum(amount * fx_rate) FROM transactions …', rows: 12, ms: 142, ok: true, saved: true, name: 'Daily P&L by desk' },
    { id: 'h2', when: '8m ago', conn: 'production', sql: 'UPDATE counterparties SET tier = \'A\' WHERE volume_30d > …', rows: 48, ms: 218, ok: true },
    { id: 'h3', when: '14m ago', conn: 'production', sql: 'SELECT id, posted_at, amount FROM transactions WHERE status = \'pending\' …', rows: 38, ms: 880, ok: true, saved: true, name: 'Stuck settlements > 24h' },
    { id: 'h4', when: '38m ago', conn: 'development', sql: 'CREATE INDEX CONCURRENTLY idx_txn_posted_at_brin ON transactions USING brin …', rows: 0, ms: 8210, ok: true },
    { id: 'h5', when: '1h ago', conn: 'production', sql: 'SELECT cpty.name, sum(t.amount*t.fx_rate) FROM transactions t JOIN counterparties …', rows: 50, ms: 1280, ok: true, saved: true, name: 'Top counterparties (30d)' },
    { id: 'h6', when: '1h ago', conn: 'production', sql: 'SELECT * FROM reconciliations WHERE status != \'matched\'', rows: 7, ms: 340, ok: true, saved: true, name: 'Reconciliation breaks' },
    { id: 'h7', when: '2h ago', conn: 'production', sql: 'DELETE FROM audit_log WHERE created_at < now() - interval \'90 days\'', rows: 0, ms: 0, ok: false, err: 'cancelled — user' },
    { id: 'h8', when: '3h ago', conn: 'production', sql: 'SELECT currency, sum(amount) FROM transactions GROUP BY 1', rows: 18, ms: 412, ok: true, saved: true, name: 'FX exposure by ccy' },
    { id: 'h9', when: 'yesterday', conn: 'staging', sql: 'EXPLAIN ANALYZE SELECT * FROM transactions WHERE posted_at > now() - …', rows: 0, ms: 4210, ok: true },
    { id: 'h10', when: 'yesterday', conn: 'production', sql: 'SELECT user_id, action, count(*) FROM audit_log WHERE action IN (\'drop\',\'truncate\') …', rows: 204, ms: 2012, ok: true, saved: true, name: 'Audit: admin writes' },
    { id: 'h11', when: 'yesterday', conn: 'production', sql: 'VACUUM ANALYZE transactions', rows: 0, ms: 42800, ok: true },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
      {/* Tabs */}
      <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, paddingLeft: 4, flexShrink: 0 }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: t.panel, borderRight: `0.5px solid ${t.border}`, borderTop: `2px solid ${SnowyTokens.accent[500]}`, color: t.text, fontSize: 12, fontWeight: 500, position: 'relative', top: 0.5 }}>
          <Ico.History size={11} color={SnowyTokens.accent[500]} />
          <span>Query history</span>
          <Ico.X size={10} color={t.textDim} />
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Header */}
      <div style={{ padding: '16px 20px 12px', background: t.panel, borderBottom: `0.5px solid ${t.divider}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: -0.3, fontFamily: SnowyTokens.font.display }}>Query history</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 5, minWidth: 280 }}>
          <Ico.Search size={12} color={t.textDim} />
          <span style={{ fontSize: 12, color: t.textDim }}>Search across 2,184 queries…</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill theme={t} bg={SnowyTokens.accent[500]} fg="#fff">All</Pill>
          <Pill theme={t}>Saved</Pill>
          <Pill theme={t}>Failed</Pill>
          <Pill theme={t}>DDL</Pill>
        </div>
      </div>

      {/* 2-col split */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* left list */}
        <div style={{ flex: 1, overflow: 'hidden', borderRight: `0.5px solid ${t.border}` }}>
          {history.map((h, i) => {
            const selected = i === 0;
            return (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                background: selected ? t.selected : (i % 2 ? t.gridStripe : 'transparent'),
                borderLeft: selected ? `2px solid ${t.selectedBorder}` : '2px solid transparent',
                borderBottom: `0.5px solid ${t.divider}`,
                minHeight: 42,
              }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: h.ok ? (h.saved ? SnowyTokens.accent[500] : SnowyTokens.sem.ok) : SnowyTokens.sem.err }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {h.saved && <Ico.Star size={10} color={SnowyTokens.sem.warn} />}
                    {h.name && <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{h.name}</span>}
                    {h.name && <span style={{ color: t.textDim, fontSize: 11 }}>·</span>}
                    <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11, color: t.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sql}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>
                    <span>{h.when}</span>
                    <span>·</span>
                    <span>{h.conn}</span>
                    {h.ok ? (
                      <>
                        <span>·</span>
                        <span>{h.rows} rows</span>
                        <span>·</span>
                        <span>{h.ms} ms</span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span style={{ color: SnowyTokens.sem.err }}>{h.err}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* right detail */}
        <div style={{ width: 360, background: t.panelAlt, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico.Star size={13} color={SnowyTokens.sem.warn} />
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Daily P&L by desk</span>
            <div style={{ flex: 1 }} />
            <Pill theme={t}>Rerun</Pill>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>
            <span>2 min ago</span>
            <span>production</span>
            <span>142 ms</span>
            <span>12 rows</span>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>Query</div>
          <pre style={{ margin: 0, padding: 10, background: t.panel, border: `0.5px solid ${t.divider}`, borderRadius: 5, fontFamily: SnowyTokens.font.mono, fontSize: 11, lineHeight: 1.55, color: t.text, whiteSpace: 'pre-wrap', overflow: 'hidden' }}>
{`WITH posted AS (
  SELECT
    date_trunc('hour', posted_at) AS hr,
    desk,
    sum(amount * fx_rate)
      FILTER (WHERE direction = 'credit') AS credits,
    sum(amount * fx_rate)
      FILTER (WHERE direction = 'debit')  AS debits
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  WHERE posted_at >= current_date
    AND status = 'posted'
  GROUP BY 1, 2
)
SELECT hr, desk, credits - debits AS pnl
FROM posted
ORDER BY hr DESC, pnl DESC;`}
          </pre>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>Plan</div>
          <div style={{ padding: 10, background: t.panel, border: `0.5px solid ${t.divider}`, borderRadius: 5, fontFamily: SnowyTokens.font.mono, fontSize: 11, color: t.textSec, lineHeight: 1.6 }}>
            <div>Sort <span style={{ color: t.textDim }}>(cost=142.2..145.0)</span></div>
            <div style={{ paddingLeft: 12 }}>HashAggregate <span style={{ color: t.textDim }}>(rows=12)</span></div>
            <div style={{ paddingLeft: 24, color: SnowyTokens.accent[500] }}>Index Scan · idx_txn_posted_at</div>
            <div style={{ paddingLeft: 24 }}>Hash Join · accounts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QueryHistory });
