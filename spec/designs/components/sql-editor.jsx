// SQL editor screen with AI copilot inline + results tabs.

function SQLTok({ children, c }) {
  return <span style={{ color: c }}>{children}</span>;
}

function SQLEditor({ theme }) {
  const t = theme;
  const kw = SnowyTokens.accent[500];      // keyword blue
  const fn = SnowyTokens.sem.purple;
  const str = SnowyTokens.sem.ok;
  const num = SnowyTokens.sem.warn;
  const com = t.textDim;
  const id = t.text;
  const tbl = SnowyTokens.sem.mag;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
      {/* Tab strip */}
      <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, paddingLeft: 4, flexShrink: 0 }}>
        {[
          { label: 'daily_pnl.sql', dirty: true, active: true, icon: <Ico.Editor size={11} /> },
          { label: 'recon_breaks.sql', icon: <Ico.Editor size={11} /> },
          { label: 'transactions', icon: <Ico.Table size={11} /> },
        ].map((tab, i) => (
          <div key={i} style={{
            height: 32, display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 10px', background: tab.active ? t.panel : 'transparent',
            borderRight: `0.5px solid ${t.border}`,
            borderTop: tab.active ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
            color: tab.active ? t.text : t.textSec,
            fontSize: 12, position: 'relative', top: 0.5,
          }}>
            <div style={{ color: tab.active ? SnowyTokens.sem.warn : t.textSec }}>{tab.icon}</div>
            <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>{tab.label}</span>
            {tab.dirty && <div style={{ width: 5, height: 5, borderRadius: 3, background: SnowyTokens.sem.warn }} />}
            <div style={{ color: t.textDim, opacity: tab.active ? 1 : 0.3 }}><Ico.X size={10} /></div>
          </div>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* Editor toolbar */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10, background: t.panel, borderBottom: `0.5px solid ${t.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px 3px 8px', background: SnowyTokens.sem.ok, color: '#fff', borderRadius: 5, fontSize: 11.5, fontWeight: 500 }}>
          <Ico.Play size={11} color="#fff" />
          <span>Run</span>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10, opacity: .8, marginLeft: 4 }}>⌘↵</span>
        </div>
        <ToolbarBtn theme={t} icon={<Ico.Save size={12} />} label="Save" />
        <div style={{ width: 1, height: 16, background: t.border }} />
        <div style={{ fontSize: 11, color: t.textSec }}>
          <span style={{ fontFamily: SnowyTokens.font.mono }}>ledger_prod</span> · <span style={{ color: t.textDim }}>public</span>
        </div>
        <div style={{ flex: 1 }} />
        <ToolbarBtn theme={t} icon={<Ico.History size={12} />} label="History" />
        <ToolbarBtn theme={t} icon={<Ico.Split size={12} />} />
        <ToolbarBtn theme={t} icon={<Ico.Dots size={12} />} />
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Code */}
          <div style={{ flex: '0 0 auto', height: '42%', minHeight: 280, display: 'flex', background: t.panel, fontFamily: SnowyTokens.font.mono, fontSize: 12.5, lineHeight: 1.65, position: 'relative' }}>
            {/* Gutter */}
            <div style={{ width: 44, padding: '10px 8px', textAlign: 'right', color: t.textDim, borderRight: `0.5px solid ${t.divider}`, userSelect: 'none' }}>
              {Array.from({ length: 16 }, (_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            {/* Lines */}
            <div style={{ flex: 1, padding: '10px 14px', color: t.text, position: 'relative' }}>
              <div style={{ color: com }}>-- Daily P&L by desk, bucketed by hour</div>
              <div><SQLTok c={kw}>WITH</SQLTok> <SQLTok c={tbl}>posted</SQLTok> <SQLTok c={kw}>AS</SQLTok> (</div>
              <div>  <SQLTok c={kw}>SELECT</SQLTok></div>
              <div>    <SQLTok c={fn}>date_trunc</SQLTok>(<SQLTok c={str}>'hour'</SQLTok>, posted_at) <SQLTok c={kw}>AS</SQLTok> hr,</div>
              <div>    desk,</div>
              <div>    <SQLTok c={fn}>sum</SQLTok>(amount * fx_rate) <SQLTok c={kw}>FILTER</SQLTok> (<SQLTok c={kw}>WHERE</SQLTok> direction = <SQLTok c={str}>'credit'</SQLTok>) <SQLTok c={kw}>AS</SQLTok> credits,</div>
              <div>    <SQLTok c={fn}>sum</SQLTok>(amount * fx_rate) <SQLTok c={kw}>FILTER</SQLTok> (<SQLTok c={kw}>WHERE</SQLTok> direction = <SQLTok c={str}>'debit'</SQLTok>)  <SQLTok c={kw}>AS</SQLTok> debits</div>
              <div>  <SQLTok c={kw}>FROM</SQLTok> <SQLTok c={tbl}>transactions</SQLTok> t</div>
              <div>  <SQLTok c={kw}>JOIN</SQLTok> <SQLTok c={tbl}>accounts</SQLTok> a <SQLTok c={kw}>ON</SQLTok> a.id = t.account_id</div>
              <div>  <SQLTok c={kw}>WHERE</SQLTok> posted_at {'>='} <SQLTok c={fn}>current_date</SQLTok></div>
              <div>    <SQLTok c={kw}>AND</SQLTok> status = <SQLTok c={str}>'posted'</SQLTok></div>
              <div>  <SQLTok c={kw}>GROUP BY</SQLTok> <SQLTok c={num}>1</SQLTok>, <SQLTok c={num}>2</SQLTok></div>
              <div>)</div>
              <div><SQLTok c={kw}>SELECT</SQLTok> hr, desk, credits - debits <SQLTok c={kw}>AS</SQLTok> pnl, credits, debits</div>
              <div><SQLTok c={kw}>FROM</SQLTok> posted</div>
              <div><SQLTok c={kw}>ORDER BY</SQLTok> hr <SQLTok c={kw}>DESC</SQLTok>, pnl <SQLTok c={kw}>DESC</SQLTok>;<span style={{ display: 'inline-block', width: 2, height: 14, background: SnowyTokens.accent[500], marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} /></div>
            </div>

            {/* Autocomplete popover */}
            <AutocompletePopover theme={t} />
          </div>

          {/* AI copilot strip */}
          <AIStrip theme={t} />

          {/* Results */}
          <ResultsPanel theme={t} />
        </div>
      </div>

      <StatusBar theme={t} />
    </div>
  );
}

function AutocompletePopover({ theme }) {
  const t = theme;
  const items = [
    { kw: 'amount', type: 'numeric(20,4)', desc: 'Signed amount in txn currency', icon: <Ico.Column size={11} color={t.textSec} />, tag: 'COL', tagC: SnowyTokens.accent[500], hot: true },
    { kw: 'account_id', type: 'uuid · fk → accounts.id', desc: 'Foreign key · indexed', icon: <Ico.Key size={11} color={SnowyTokens.accent[500]} />, tag: 'FK', tagC: SnowyTokens.accent[500] },
    { kw: 'amount_usd', type: 'numeric · generated', desc: 'amount * fx_rate (stored)', icon: <Ico.Column size={11} color={SnowyTokens.sem.purple} />, tag: 'GEN', tagC: SnowyTokens.sem.purple },
    { kw: 'avg()', type: 'agg(numeric) → numeric', desc: 'Arithmetic mean, ignores nulls', icon: <Ico.Function size={11} color={SnowyTokens.sem.purple} />, tag: 'FN', tagC: SnowyTokens.sem.purple },
    { kw: 'abs()', type: '(numeric) → numeric', desc: 'Absolute value', icon: <Ico.Function size={11} color={SnowyTokens.sem.purple} />, tag: 'FN', tagC: SnowyTokens.sem.purple },
    { kw: 'ARRAY_AGG', type: 'keyword · aggregate', desc: 'Collect values into an array', icon: <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 9, color: SnowyTokens.accent[500], fontWeight: 800 }}>KW</span>, tag: 'KW', tagC: SnowyTokens.accent[500] },
    { kw: 'accounts', type: 'table · 1.24M rows', desc: 'public.accounts', icon: <Ico.Table size={11} color={t.textSec} />, tag: 'TBL', tagC: SnowyTokens.sem.mag },
    { kw: 'audit_log', type: 'table · 312M rows', desc: 'public.audit_log · partitioned', icon: <Ico.Table size={11} color={t.textSec} />, tag: 'TBL', tagC: SnowyTokens.sem.mag },
  ];
  return (
    <div style={{
      position: 'absolute', left: 268, top: 182,
      width: 440,
      background: t.panelAlt,
      border: `0.5px solid ${t.borderStrong}`,
      borderRadius: 7,
      boxShadow: t.shadow,
      zIndex: 4, overflow: 'hidden',
      fontFamily: SnowyTokens.font.ui, fontSize: 12,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '5px 10px', background: t.panel, borderBottom: `0.5px solid ${t.divider}`, fontSize: 10, color: t.textDim, fontFamily: SnowyTokens.font.mono, display: 'flex', gap: 10 }}>
        <span>autocomplete · 8 matches for <span style={{ color: SnowyTokens.accent[500] }}>a</span></span>
        <div style={{ flex: 1 }} />
        <span>columns · functions · keywords · tables</span>
      </div>
      {items.map((it, i) => (
        <div key={it.kw} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px',
          background: i === 0 ? t.selected : 'transparent',
          borderLeft: i === 0 ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
        }}>
          <div style={{ width: 24, padding: '0 3px', borderRadius: 3, fontSize: 9, fontWeight: 800, color: '#fff', background: it.tagC, textAlign: 'center', letterSpacing: 0.3, fontFamily: SnowyTokens.font.mono }}>{it.tag}</div>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 12, color: i === 0 ? t.text : t.textSec, fontWeight: i === 0 ? 700 : 500, minWidth: 100 }}>
            <span style={{ color: SnowyTokens.accent[500] }}>{it.kw[0]}</span>{it.kw.slice(1)}
          </span>
          <span style={{ fontSize: 10.5, color: t.textSec, fontFamily: SnowyTokens.font.mono }}>{it.type}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: t.textDim, fontStyle: 'italic' }}>{it.desc}</span>
        </div>
      ))}
      <div style={{ padding: '4px 10px', fontSize: 10, color: t.textDim, borderTop: `0.5px solid ${t.divider}`, display: 'flex', gap: 10, fontFamily: SnowyTokens.font.mono, background: t.panel }}>
        <span>↑↓ nav</span><span>↵ insert</span><span>⇥ accept + .</span><span>⌘. ask AI</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: t.textDim }}>learned from <span style={{ color: SnowyTokens.accent[500] }}>public.transactions</span></span>
      </div>
    </div>
  );
}

function AIStrip({ theme }) {
  const t = theme;
  return (
    <div style={{
      margin: '10px 12px', padding: '10px 12px',
      background: t.panelAlt,
      border: `0.5px solid ${t.border}`,
      borderLeft: `2px solid ${SnowyTokens.sem.purple}`,
      borderRadius: 6,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{ color: SnowyTokens.sem.purple, marginTop: 1 }}><Ico.Sparkle size={14} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.textDim, fontFamily: SnowyTokens.font.mono, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: SnowyTokens.sem.purple, fontWeight: 600 }}>snowy ai</span>
          <span>·</span>
          <span>suggestion for line 14</span>
        </div>
        <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.5, fontFamily: SnowyTokens.font.ui }}>
          You're summing <span style={{ fontFamily: SnowyTokens.font.mono, color: SnowyTokens.accent[500] }}>amount * fx_rate</span> but <span style={{ fontFamily: SnowyTokens.font.mono, color: SnowyTokens.accent[500] }}>fx_rate</span> is nullable for same-currency transactions. Use <span style={{ fontFamily: SnowyTokens.font.mono, color: SnowyTokens.accent[500] }}>COALESCE(fx_rate, 1)</span> to avoid dropped rows.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <Pill theme={t} bg={SnowyTokens.sem.purple} fg="#fff">Apply fix</Pill>
          <Pill theme={t}>Explain</Pill>
          <Pill theme={t}>Dismiss</Pill>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, color: t.textDim, fontFamily: SnowyTokens.font.mono, alignSelf: 'center' }}>⌘. to ask</div>
        </div>
      </div>
    </div>
  );
}

function Pill({ theme, bg, fg, children }) {
  const t = theme;
  return (
    <div style={{
      padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500,
      background: bg || t.panel, color: fg || t.text, border: bg ? 'none' : `0.5px solid ${t.border}`,
    }}>{children}</div>
  );
}

function ResultsPanel({ theme }) {
  const t = theme;
  const rows = [
    ['2026-04-21 14:00:00+00', 'Macro',      '+284,128.40', '412,008.00', '127,879.60'],
    ['2026-04-21 14:00:00+00', 'Equities',   '+108,401.22', '880,022.00', '771,620.78'],
    ['2026-04-21 14:00:00+00', 'Credit',     '+42,821.10',  '88,900.00',  '46,078.90'],
    ['2026-04-21 14:00:00+00', 'FX',         '−18,044.02',  '120,000.00', '138,044.02'],
    ['2026-04-21 13:00:00+00', 'Macro',      '+92,004.00',  '211,400.00', '119,396.00'],
    ['2026-04-21 13:00:00+00', 'Equities',   '+62,201.88',  '712,880.00', '650,678.12'],
    ['2026-04-21 13:00:00+00', 'Credit',     '+8,101.04',   '41,100.00',  '33,998.96'],
    ['2026-04-21 13:00:00+00', 'FX',         '+22,880.00',  '92,000.00',  '69,120.00'],
  ];
  // Pinned result sets — each previous Run the user chose to keep.
  const tabs = [
    { label: 'Result 1', rows: 12, ms: 142, active: true, pinned: false, at: 'just now' },
    { label: 'Result · 14:02', rows: 12, ms: 151, pinned: true, at: '6m ago' },
    { label: 'Result · 13:48', rows: 12, ms: 144, pinned: true, at: '20m ago' },
    { label: 'Result · 09:14 UTC', rows: 18, ms: 208, pinned: true, diff: '+6', at: 'this morning' },
    { label: 'Messages', messages: true },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: `0.5px solid ${t.border}`, background: t.panel }}>
      {/* Tabs */}
      <div style={{ height: 30, display: 'flex', alignItems: 'stretch', gap: 0, paddingLeft: 10, borderBottom: `0.5px solid ${t.divider}`, fontSize: 11.5, fontFamily: SnowyTokens.font.ui }}>
        {tabs.map((tab, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '0 10px',
            color: tab.active ? t.text : t.textSec,
            borderBottom: tab.active ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
            fontWeight: tab.active ? 600 : 400,
            marginBottom: -0.5,
          }}>
            {tab.pinned && <div style={{ transform: 'rotate(35deg)', color: SnowyTokens.accent[500] }}><Ico.Pin size={10} /></div>}
            {tab.messages && <Ico.Dot size={10} color={SnowyTokens.sem.ok} />}
            <span>{tab.label}</span>
            {tab.diff && <span style={{ fontSize: 9.5, padding: '0 4px', background: SnowyTokens.sem.warn + '30', color: SnowyTokens.sem.warn, borderRadius: 3, fontFamily: SnowyTokens.font.mono, fontWeight: 600 }}>{tab.diff}</span>}
            {tab.pinned && <Ico.X size={9} color={t.textDim} />}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: t.textDim, fontSize: 10.5, fontFamily: SnowyTokens.font.mono }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: SnowyTokens.accent[500] }} title="Pin result">
            <div style={{ transform: 'rotate(35deg)' }}><Ico.Pin size={11} /></div>
            <span>Pin result</span>
          </div>
          <span style={{ color: t.textDim }}>·</span>
          <span><span style={{ color: SnowyTokens.sem.ok }}>● </span>12 rows</span>
          <span>142 ms</span>
        </div>
      </div>
      {/* Result grid */}
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>
        <div style={{ display: 'flex', background: t.gridHeader, borderBottom: `0.5px solid ${t.borderStrong}`, fontFamily: SnowyTokens.font.ui, color: t.textSec, fontWeight: 500, fontSize: 11 }}>
          <div style={{ width: 36, padding: '5px 6px', textAlign: 'right', borderRight: `0.5px solid ${t.divider}` }}>#</div>
          {[
            { l: 'hr', m: 'timestamptz', w: 1.8 },
            { l: 'desk', m: 'text', w: 1 },
            { l: 'pnl', m: 'numeric', w: 1.2 },
            { l: 'credits', m: 'numeric', w: 1.2 },
            { l: 'debits', m: 'numeric', w: 1.2 },
          ].map((c, i) => (
            <div key={i} style={{ flex: c.w, padding: '5px 8px', borderRight: `0.5px solid ${t.divider}`, display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ color: t.text, fontWeight: 600 }}>{c.l}</span>
              <span style={{ color: t.textDim, fontFamily: SnowyTokens.font.mono, fontSize: 10 }}>{c.m}</span>
            </div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', background: i % 2 ? t.gridStripe : 'transparent', borderBottom: `0.5px solid ${t.divider}`, height: 23 }}>
            <div style={{ width: 36, padding: '4px 6px', textAlign: 'right', color: t.textDim, borderRight: `0.5px solid ${t.divider}`, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
            <div style={{ flex: 1.8, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`, color: t.textSec, display: 'flex', alignItems: 'center' }}>{r[0]}</div>
            <div style={{ flex: 1, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`, color: t.text, display: 'flex', alignItems: 'center' }}>{r[1]}</div>
            <div style={{ flex: 1.2, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`, textAlign: 'right', color: r[2].startsWith('−') ? SnowyTokens.sem.err : SnowyTokens.sem.ok, fontWeight: 600, justifyContent: 'flex-end', display: 'flex', alignItems: 'center' }}>{r[2]}</div>
            <div style={{ flex: 1.2, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`, textAlign: 'right', color: t.textSec, justifyContent: 'flex-end', display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{r[3]}</div>
            <div style={{ flex: 1.2, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`, textAlign: 'right', color: t.textSec, justifyContent: 'flex-end', display: 'flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{r[4]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SQLEditor });
