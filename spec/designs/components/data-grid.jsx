// Data grid — DataGrip-dense.

function DataGrid({ theme, cols, rows, selectedRow = 2 }) {
  const t = theme;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.panel, overflow: 'hidden', fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>
      {/* Header row */}
      <div style={{ display: 'flex', background: t.gridHeader, borderBottom: `0.5px solid ${t.borderStrong}`, flexShrink: 0, color: t.textSec, fontSize: 11, fontWeight: 500, fontFamily: SnowyTokens.font.ui }}>
        <div style={{ width: 40, padding: '5px 6px', borderRight: `0.5px solid ${t.divider}`, textAlign: 'right', color: t.textDim }}>#</div>
        {cols.map((c) => (
          <div key={c.name} style={{ flex: c.w || 1, minWidth: c.mw || 100, padding: '5px 8px', borderRight: `0.5px solid ${t.divider}`, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {c.pk && <div style={{ color: SnowyTokens.sem.warn }}><Ico.Key size={10} /></div>}
            {c.fk && !c.pk && <div style={{ color: SnowyTokens.accent[500] }}><Ico.Key size={10} /></div>}
            <span style={{ color: t.text, fontWeight: 600 }}>{c.name}</span>
            <span style={{ color: t.textDim, fontWeight: 400, fontFamily: SnowyTokens.font.mono, fontSize: 10 }}>{c.type}</span>
            {c.idx && <div style={{ width: 3, height: 3, borderRadius: 2, background: SnowyTokens.accent[500] }} />}
          </div>
        ))}
      </div>
      {/* Rows */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const sel = i === selectedRow;
          return (
            <div key={r.id} style={{
              display: 'flex',
              background: sel ? t.selected : (i % 2 ? t.gridStripe : 'transparent'),
              borderBottom: `0.5px solid ${t.divider}`,
              color: t.text,
              height: 24,
              alignItems: 'stretch',
            }}>
              <div style={{ width: 40, padding: '4px 6px', color: t.textDim, textAlign: 'right', borderRight: `0.5px solid ${t.divider}`, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
              <GridCell t={t} w={cols[0].w} mw={cols[0].mw} mono><span style={{ color: SnowyTokens.sem.mag }}>{r.id}</span></GridCell>
              <GridCell t={t} w={cols[1].w} mw={cols[1].mw} mono><span style={{ color: t.textSec }}>{r.posted}</span></GridCell>
              <GridCell t={t} w={cols[2].w} mw={cols[2].mw} mono><span style={{ color: SnowyTokens.sem.info }}>{r.account}</span></GridCell>
              <GridCell t={t} w={cols[3].w} mw={cols[3].mw}>{r.cpty}</GridCell>
              <GridCell t={t} w={cols[4].w} mw={cols[4].mw} mono align="right">
                <span style={{ color: r.amount.startsWith('−') ? SnowyTokens.sem.err : SnowyTokens.sem.ok, fontWeight: 600 }}>{r.amount}</span>
              </GridCell>
              <GridCell t={t} w={cols[5].w} mw={cols[5].mw} mono><span style={{ color: t.textSec }}>{r.ccy}</span></GridCell>
              <GridCell t={t} w={cols[6].w} mw={cols[6].mw}>
                <span style={{ color: r.dir === 'credit' ? SnowyTokens.sem.ok : SnowyTokens.sem.err }}>{r.dir}</span>
              </GridCell>
              <GridCell t={t} w={cols[7].w} mw={cols[7].mw}><StatusChip status={r.status} theme={t} /></GridCell>
              <GridCell t={t} w={cols[8].w} mw={cols[8].mw} mono><span style={{ color: t.textSec }}>{r.ref}</span></GridCell>
              <GridCell t={t} w={cols[9].w} mw={cols[9].mw}><span style={{ color: t.textSec }}>{r.memo}</span></GridCell>
              <GridCell t={t} w={cols[10].w} mw={cols[10].mw} mono align="right"><span style={{ color: t.textSec, fontVariantNumeric: 'tabular-nums' }}>{r.fx}</span></GridCell>
              <GridCell t={t} w={cols[11].w} mw={cols[11].mw} mono align="right"><span style={{ color: r.fee === '0.0000' ? t.textDim : t.text, fontVariantNumeric: 'tabular-nums' }}>{r.fee}</span></GridCell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GridCell({ t, w = 1, mw = 100, children, mono = false, align = 'left' }) {
  return (
    <div style={{
      flex: w, minWidth: mw,
      padding: '4px 8px',
      borderRight: `0.5px solid ${t.divider}`,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      textAlign: align,
      fontFamily: mono ? SnowyTokens.font.mono : SnowyTokens.font.ui,
      fontSize: mono ? 11.5 : 12,
      display: 'flex', alignItems: 'center',
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
    }}>{children}</div>
  );
}

function StatusChip({ status, theme }) {
  const m = {
    posted:   { bg: 'oklch(0.60 0.14 155 / .15)', fg: 'oklch(0.50 0.14 155)', dot: SnowyTokens.sem.ok },
    pending:  { bg: 'oklch(0.70 0.15 75 / .15)', fg: 'oklch(0.50 0.15 75)', dot: SnowyTokens.sem.warn },
    failed:   { bg: 'oklch(0.58 0.19 25 / .15)', fg: 'oklch(0.52 0.19 25)', dot: SnowyTokens.sem.err },
    reversed: { bg: 'oklch(0.58 0.17 290 / .15)', fg: 'oklch(0.52 0.17 290)', dot: SnowyTokens.sem.purple },
  }[status] || {};
  const isDark = theme === SnowyDark;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '1px 6px 1px 5px', borderRadius: 3,
      background: m.bg,
      color: isDark ? `oklch(0.85 0.14 ${status === 'posted' ? '155' : status === 'pending' ? '75' : status === 'failed' ? '25' : '290'})` : m.fg,
      fontSize: 11, fontFamily: SnowyTokens.font.ui, fontWeight: 500,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: 3, background: m.dot }} />
      {status}
    </div>
  );
}

Object.assign(window, { DataGrid, StatusChip });
