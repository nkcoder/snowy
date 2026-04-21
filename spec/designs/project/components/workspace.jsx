// Workspace — tabbed main content area with tabs, table header, tool strip,
// data grid and inspector. This is the primary "work" screen.

function Workspace({ theme }) {
  const t = theme;
  const tabs = [
    { id: 'txn', icon: <Ico.Table size={11} />, label: 'transactions', color: SnowyTokens.accent[500], dirty: false, active: true },
    { id: 'acc', icon: <Ico.Table size={11} />, label: 'accounts', color: t.textSec },
    { id: 'le',  icon: <Ico.Table size={11} />, label: 'ledger_entries', color: t.textSec },
    { id: 'q1',  icon: <Ico.Editor size={11} />, label: 'daily_pnl.sql', color: SnowyTokens.sem.warn, dirty: true },
    { id: 'q2',  icon: <Ico.Editor size={11} />, label: 'recon_breaks.sql', color: t.textSec },
  ];

  const cols = [
    { ...SnowyData.txnCols[0], w: 0.9, mw: 90 },
    { ...SnowyData.txnCols[1], w: 1.6, mw: 170 },
    { ...SnowyData.txnCols[2], w: 1.3, mw: 140 },
    { ...SnowyData.txnCols[3], w: 1.2, mw: 130 },
    { ...SnowyData.txnCols[4], w: 1.2, mw: 120 },
    { ...SnowyData.txnCols[5], w: 0.5, mw: 52 },
    { ...SnowyData.txnCols[6], w: 0.7, mw: 72 },
    { ...SnowyData.txnCols[7], w: 0.9, mw: 90 },
    { ...SnowyData.txnCols[8], w: 1.1, mw: 110 },
    { ...SnowyData.txnCols[9], w: 2.0, mw: 200 },
    { ...SnowyData.txnCols[10], w: 0.9, mw: 96 },
    { ...SnowyData.txnCols[11], w: 0.7, mw: 72 },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
      {/* Tab strip */}
      <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, paddingLeft: 4, flexShrink: 0 }}>
        {tabs.map((tab) => (
          <div key={tab.id} style={{
            height: 32,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 10px 0 10px',
            background: tab.active ? t.panel : 'transparent',
            borderRight: `0.5px solid ${t.border}`,
            borderTop: tab.active ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
            marginTop: tab.active ? -0.5 : 0,
            color: tab.active ? t.text : t.textSec,
            fontSize: 12,
            fontWeight: tab.active ? 500 : 400,
            position: 'relative', top: 0.5,
          }}>
            <div style={{ color: tab.color }}>{tab.icon}</div>
            <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>{tab.label}</span>
            {tab.dirty && <div style={{ width: 5, height: 5, borderRadius: 3, background: SnowyTokens.sem.warn }} />}
            <div style={{ color: t.textDim, marginLeft: 4, opacity: tab.active ? 1 : 0.3 }}><Ico.X size={10} /></div>
          </div>
        ))}
        <div style={{ padding: '0 10px', color: t.textDim, display: 'flex', alignItems: 'center', height: 32 }}>
          <Ico.Plus size={11} />
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Table toolbar */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 12, background: t.panel, borderBottom: `0.5px solid ${t.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.Table size={13} color={SnowyTokens.accent[500]} />
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 12, color: t.textSec }}>public.</span>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 12, fontWeight: 600, color: t.text }}>transactions</span>
        </div>
        <div style={{ width: 1, height: 16, background: t.border }} />
        <ToolbarBtn theme={t} icon={<Ico.Refresh size={12} />} />
        <ToolbarBtn theme={t} icon={<Ico.Plus size={12} />} label="Row" />
        <ToolbarBtn theme={t} icon={<Ico.Filter size={12} />} label="Filter" active />
        <ToolbarBtn theme={t} icon={<Ico.Sort size={12} />} label="Sort" />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 5, fontSize: 11, fontFamily: SnowyTokens.font.mono, color: t.textSec }}>
          <span style={{ color: SnowyTokens.accent[500] }}>WHERE</span>
          <span>status = 'posted'</span>
          <span style={{ color: t.textDim }}>AND</span>
          <span>posted_at {'>'}  now() - interval '1 hour'</span>
          <Ico.X size={10} color={t.textDim} />
        </div>
        <ToolbarBtn theme={t} icon={<Ico.Grid size={12} />} label="View" />
        <ToolbarBtn theme={t} icon={<Ico.Dots size={12} />} />
      </div>

      {/* Grid + inspector */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <DataGrid theme={t} cols={cols} rows={SnowyData.txnRows} selectedRow={2} />
        <RowInspector theme={t} row={SnowyData.txnRows[2]} />
      </div>

      {/* Status bar */}
      <StatusBar theme={t} />
    </div>
  );
}

function ToolbarBtn({ theme, icon, label, active = false }) {
  const t = theme;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 7px',
      background: active ? t.hover : 'transparent',
      color: active ? t.text : t.textSec,
      borderRadius: 4,
      fontSize: 11.5,
    }}>
      {icon}
      {label && <span>{label}</span>}
    </div>
  );
}

function RowInspector({ theme, row }) {
  const t = theme;
  return (
    <div style={{ width: 280, borderLeft: `0.5px solid ${t.border}`, background: t.panelAlt, padding: '12px 14px', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: t.textDim, textTransform: 'uppercase' }}>Row · 3 of 14M</div>
        <div style={{ flex: 1 }} />
        <Ico.ChevronRight size={11} color={t.textDim} />
      </div>
      <div style={{ fontFamily: SnowyTokens.font.mono, fontSize: 13, color: SnowyTokens.sem.mag, fontWeight: 600 }}>{row.id}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusChip status={row.status} theme={t} />
        <div style={{ fontSize: 11, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>{row.ccy}</div>
      </div>

      <div style={{ height: 1, background: t.divider, margin: '4px 0' }} />

      {[
        ['posted_at', row.posted],
        ['account_id', row.account],
        ['counterparty', row.cpty],
        ['amount', row.amount, row.amount.startsWith('−') ? SnowyTokens.sem.err : SnowyTokens.sem.ok],
        ['reference', row.ref],
        ['memo', row.memo],
        ['fx_rate', row.fx],
        ['fee', row.fee],
      ].map(([k, v, col]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>{k}</div>
          <div style={{ fontSize: 12, color: col || t.text, fontFamily: SnowyTokens.font.mono, wordBreak: 'break-all' }}>{v}</div>
        </div>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `0.5px solid ${t.divider}` }}>
        <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono, marginBottom: 4 }}>metadata</div>
        <pre style={{ margin: 0, fontSize: 10.5, fontFamily: SnowyTokens.font.mono, color: t.textSec, lineHeight: 1.5, whiteSpace: 'pre-wrap', background: t.panel, padding: 8, borderRadius: 4, border: `0.5px solid ${t.divider}` }}>
{`{
  "channel": "wire",
  "origin": "DE",
  "risk_score": 0.02
}`}
        </pre>
      </div>
    </div>
  );
}

function StatusBar({ theme }) {
  const t = theme;
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 14, background: t.chrome, borderTop: `0.5px solid ${t.border}`, fontSize: 10.5, color: t.textSec, fontFamily: SnowyTokens.font.mono, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: SnowyTokens.sem.ok, boxShadow: `0 0 6px ${SnowyTokens.sem.ok}` }} />
        prod-db.internal:5432
      </div>
      <div>ledger_prod</div>
      <div>utf-8</div>
      <div style={{ flex: 1 }} />
      <div>14 rows · limit 500</div>
      <div>142 ms</div>
      <div style={{ color: t.textDim }}>Ln 1, Col 1</div>
      <div style={{ color: t.textDim }}>UTC−05:00</div>
    </div>
  );
}

Object.assign(window, { Workspace, ToolbarBtn, StatusBar });
