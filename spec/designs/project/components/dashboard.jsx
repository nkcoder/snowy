// Dashboard screen — pinned query tiles.

function Dashboard({ theme }) {
  const t = theme;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
      {/* Tab strip */}
      <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, paddingLeft: 4, flexShrink: 0 }}>
        {[
          { label: 'Ledger · overview', icon: <Ico.Dash size={11} />, active: true, color: SnowyTokens.accent[500] },
          { label: 'transactions', icon: <Ico.Table size={11} /> },
          { label: 'daily_pnl.sql', icon: <Ico.Editor size={11} />, dirty: true, color: SnowyTokens.sem.warn },
        ].map((tab, i) => (
          <div key={i} style={{
            height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
            background: tab.active ? t.panel : 'transparent',
            borderRight: `0.5px solid ${t.border}`,
            borderTop: tab.active ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
            color: tab.active ? t.text : t.textSec,
            fontSize: 12, position: 'relative', top: 0.5,
          }}>
            <div style={{ color: tab.color || t.textSec }}>{tab.icon}</div>
            <span style={{ fontFamily: tab.label.endsWith('.sql') ? SnowyTokens.font.mono : SnowyTokens.font.ui, fontSize: 11.5 }}>{tab.label}</span>
            {tab.dirty && <div style={{ width: 5, height: 5, borderRadius: 3, background: SnowyTokens.sem.warn }} />}
            <Ico.X size={10} color={t.textDim} />
          </div>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Dashboard header */}
      <div style={{ padding: '20px 24px 14px', borderBottom: `0.5px solid ${t.divider}`, background: t.panel }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: -0.4, fontFamily: SnowyTokens.font.display }}>Ledger · overview</div>
          <div style={{ fontSize: 12, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>ledger_prod · 6 pinned queries</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: t.textSec, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ico.Refresh size={11} />
            <span>Auto-refresh · 30s</span>
          </div>
          <Pill theme={t} bg={SnowyTokens.accent[500]} fg="#fff">+ Pin query</Pill>
        </div>
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 16, background: t.bg, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gridTemplateRows: '160px 1fr', gap: 12 }}>
        <StatTile theme={t} title="Total posted volume (24h)" value="$4.28B" delta="+12.4%" deltaPos
                  sub="8.4M txns · 142 desks" spark="up" color={SnowyTokens.accent[500]} />
        <StatTile theme={t} title="Net P&L · today" value="+$12.8M" delta="+4.1%" deltaPos
                  sub="Credits outpacing debits" spark="up" color={SnowyTokens.sem.ok} />
        <StatTile theme={t} title="Stuck settlements > 24h" value="38" delta="+11" deltaNeg
                  sub="$14.2M notional at risk" spark="down" color={SnowyTokens.sem.err} />

        <ChartTile theme={t} title="Daily P&L by desk" query="SELECT desk, sum(amount*fx_rate) …" />
        <ListTile theme={t} title="Top counterparties (30d)" items={[
          ['Stripe Inc.', '$412.8M'], ['Adyen', '$284.1M'], ['Plaid', '$204.0M'],
          ['Deutsche Bank', '$180.4M'], ['Citibank', '$128.9M'], ['HSBC', '$92.1M'],
        ]} />
        <BreaksTile theme={t} />
      </div>
    </div>
  );
}

function StatTile({ theme, title, value, delta, deltaPos, deltaNeg, sub, spark, color }) {
  const t = theme;
  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ico.Pin size={10} color={t.textDim} />
        <div style={{ fontSize: 11, color: t.textSec, fontWeight: 500 }}>{title}</div>
        <div style={{ flex: 1 }} />
        <Ico.Dots size={12} color={t.textDim} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: -0.5, fontFamily: SnowyTokens.font.display, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: deltaPos ? SnowyTokens.sem.ok : SnowyTokens.sem.err, fontFamily: SnowyTokens.font.mono }}>{delta}</div>
        <div style={{ fontSize: 11, color: t.textDim }}>{sub}</div>
      </div>
      {/* mini sparkline */}
      <svg viewBox="0 0 160 32" preserveAspectRatio="none" style={{ position: 'absolute', right: 12, bottom: 10, width: 120, height: 28, opacity: .9 }}>
        <path d={spark === 'up'
          ? 'M0 24 L20 20 L36 22 L52 14 L72 18 L92 10 L112 12 L132 6 L160 2'
          : 'M0 6 L22 10 L42 8 L60 16 L82 14 L104 20 L124 18 L146 26 L160 30'}
          fill="none" stroke={color} strokeWidth="1.5" />
        <path d={spark === 'up'
          ? 'M0 24 L20 20 L36 22 L52 14 L72 18 L92 10 L112 12 L132 6 L160 2 L160 32 L0 32 Z'
          : 'M0 6 L22 10 L42 8 L60 16 L82 14 L104 20 L124 18 L146 26 L160 30 L160 32 L0 32 Z'}
          fill={color} fillOpacity=".1" />
      </svg>
    </div>
  );
}

function ChartTile({ theme, title, query }) {
  const t = theme;
  const bars = [42, 58, 64, 72, 68, 78, 82, 74, 88, 96, 92, 104];
  const maxB = Math.max(...bars);
  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ico.Pin size={10} color={t.textDim} />
        <div style={{ fontSize: 11, color: t.textSec, fontWeight: 500 }}>{title}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>142 ms</div>
      </div>
      <div style={{ fontSize: 10, color: t.textDim, fontFamily: SnowyTokens.font.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{query}</div>
      {/* chart */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '8px 0 0' }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}>
            <div style={{ height: `${(b / maxB) * 100}%`, background: `linear-gradient(180deg, ${SnowyTokens.accent[500]}, ${SnowyTokens.accent[700]})`, borderRadius: '2px 2px 0 0' }} />
            <div style={{ height: 18, background: SnowyTokens.accent[500], opacity: .35, borderRadius: '0 0 2px 2px' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: t.textDim, fontFamily: SnowyTokens.font.mono, borderTop: `0.5px solid ${t.divider}`, paddingTop: 8 }}>
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: SnowyTokens.accent[500] }} /> credits</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, background: SnowyTokens.accent[500], opacity: .35 }} /> debits</span>
      </div>
    </div>
  );
}

function ListTile({ theme, title, items }) {
  const t = theme;
  const max = 412.8;
  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ico.Pin size={10} color={t.textDim} />
        <div style={{ fontSize: 11, color: t.textSec, fontWeight: 500 }}>{title}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
        {items.map(([name, v], i) => {
          const num = parseFloat(v.replace(/[^0-9.]/g, ''));
          return (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', fontSize: 11.5, fontFamily: SnowyTokens.font.ui }}>
                <span style={{ color: t.text }}>{name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ color: t.textSec, fontFamily: SnowyTokens.font.mono, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
              <div style={{ height: 3, background: t.panelAlt, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(num / max) * 100}%`, height: '100%', background: SnowyTokens.accent[500] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreaksTile({ theme }) {
  const t = theme;
  const breaks = [
    { id: 'rcn_8842', amt: '$4.2M', age: '38h', desk: 'Macro', sev: 'high' },
    { id: 'rcn_8821', amt: '$1.8M', age: '29h', desk: 'FX', sev: 'high' },
    { id: 'rcn_8809', amt: '$892K', age: '26h', desk: 'Credit', sev: 'med' },
    { id: 'rcn_8799', amt: '$421K', age: '25h', desk: 'Equities', sev: 'med' },
    { id: 'rcn_8782', amt: '$208K', age: '24h', desk: 'Macro', sev: 'low' },
  ];
  return (
    <div style={{ background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Ico.Pin size={10} color={t.textDim} />
        <div style={{ fontSize: 11, color: t.textSec, fontWeight: 500 }}>Reconciliation breaks · today</div>
        <div style={{ flex: 1 }} />
        <Pill theme={t}>View all</Pill>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {breaks.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < breaks.length - 1 ? `0.5px solid ${t.divider}` : 'none', fontSize: 11.5 }}>
            <div style={{ width: 4, height: 22, borderRadius: 2, background: b.sev === 'high' ? SnowyTokens.sem.err : b.sev === 'med' ? SnowyTokens.sem.warn : t.textDim }} />
            <span style={{ fontFamily: SnowyTokens.font.mono, color: SnowyTokens.sem.mag }}>{b.id}</span>
            <span style={{ color: t.textSec }}>· {b.desk}</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: t.textDim, fontFamily: SnowyTokens.font.mono, fontSize: 10.5 }}>{b.age}</span>
            <span style={{ color: SnowyTokens.sem.err, fontFamily: SnowyTokens.font.mono, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{b.amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
