// Workspace — DataGrip layout.
//  Top panel   : Database Explorer (sidebar) + Console (editor) side-by-side
//  Bottom panel: Services — mini-tree (servers + consoles) + Output/results tabs
// Pin tab is always visible on result tabs as a toggle affordance.

function Workspace({ theme }) {
  const t = theme;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
      {/* Top half — Database Explorer + Console editor */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left is rendered by outer App (SnowySidebar) — here we're just the right pane */}
        <ConsolePane theme={t} />
      </div>

      {/* Bottom half — Services panel */}
      <ServicesPanel theme={t} />

      <StatusBar theme={t} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Console pane (SQL editor)
function ConsolePane({ theme }) {
  const t = theme;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.panel }}>
      {/* Tool window header */}
      <ToolWindowHeader theme={t}
        tabs={[{ icon: <Ico.Database size={11} color={SnowyTokens.accent[500]} />, label: 'console [snowy@dev]', active: true }]}
        trailingPlus
      />

      {/* Editor toolbar */}
      <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, background: t.chrome, borderBottom: `0.5px solid ${t.divider}` }}>
        <ToolIcon theme={t} tone={SnowyTokens.sem.ok} icon={<Ico.Play size={11} color={SnowyTokens.sem.ok} />} title="Execute ⌘↵" />
        <ToolIcon theme={t} icon={<Ico.Lightning size={11} />} title="Execute as statement" />
        <ToolIcon theme={t} icon={<Ico.Clock size={11} />} title="History" />
        <ToolIcon theme={t} icon={<Ico.Stop size={10} />} title="Cancel" muted />
        <ToolIcon theme={t} icon={<Ico.Sidebar size={11} />} title="Transaction" />
        <Divider theme={t} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.textSec, padding: '0 8px' }}>
          <span>Tx:</span>
          <span style={{ color: t.text, fontWeight: 500 }}>Auto</span>
          <Ico.ChevronDown size={9} color={t.textDim} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.textSec, padding: '0 8px' }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill={SnowyTokens.accent[500]} /></svg>
          <span style={{ color: t.text, fontWeight: 500 }}>Playground</span>
          <Ico.ChevronDown size={9} color={t.textDim} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.textSec, padding: '0 8px' }}>
          <Ico.Schema size={11} color={SnowyTokens.accent[500]} />
          <span style={{ fontFamily: SnowyTokens.font.mono }}>mydatabase.public</span>
          <Ico.ChevronDown size={9} color={t.textDim} />
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, fontFamily: SnowyTokens.font.mono, fontSize: 13, lineHeight: 1.65, background: t.panel, position: 'relative' }}>
        <EditorGutter theme={t} count={12} runMarks={{ 1: 'ok', 2: 'ok' }} />
        <div style={{ flex: 1, padding: '8px 14px', color: t.text, minWidth: 0 }}>
          <div>
            <span style={{ color: SnowyTokens.accent[500] }}>select</span>{' '}
            <span style={{ background: SnowyTokens.accent[500] + '40', padding: '0 2px' }}>*</span>
          </div>
          <div>
            <span style={{ color: SnowyTokens.accent[500] }}>from</span>{' '}
            <span style={{ color: SnowyTokens.sem.mag }}>users</span>
            <span style={{ color: t.text }}>;</span>
            <span style={{ display: 'inline-block', width: 2, height: 14, background: SnowyTokens.accent[500], marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />
          </div>
        </div>

        {/* Success tick column on right */}
        <div style={{ position: 'absolute', right: 8, top: 8, color: SnowyTokens.sem.ok }}>
          <Ico.Check size={11} color={SnowyTokens.sem.ok} />
        </div>
      </div>
    </div>
  );
}

function EditorGutter({ theme, count, runMarks = {} }) {
  const t = theme;
  return (
    <div style={{
      width: 36, padding: '8px 6px 8px 0', textAlign: 'right', color: t.textDim,
      borderRight: `0.5px solid ${t.divider}`, userSelect: 'none',
      fontFamily: SnowyTokens.font.mono, fontSize: 11.5, lineHeight: 1.65,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    }}>
      {Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const mark = runMarks[n];
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%', height: 21.5 }}>
            {mark === 'ok' && <span style={{ color: SnowyTokens.sem.ok, lineHeight: 1 }}>✓</span>}
            <span>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Services panel (bottom)
function ServicesPanel({ theme }) {
  const t = theme;
  return (
    <div style={{ height: 320, display: 'flex', minHeight: 0, borderTop: `1px solid ${t.borderStrong}`, background: t.panel }}>
      {/* Services tree */}
      <div style={{ width: 220, background: t.sidebar, borderRight: `0.5px solid ${t.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <ToolWindowHeader theme={t} tabs={[{ label: 'Services', active: true, bare: true }]} compact />
        <div style={{ padding: '4px 8px', borderBottom: `0.5px solid ${t.divider}`, background: t.chrome, display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10.5, fontWeight: 700, color: t.textSec, padding: '0 6px' }}>Tx</div>
          {[<Ico.Plus size={11} />, <Ico.View size={11} />, <Ico.Enter size={11} />, <Ico.Stop size={10} />, <Ico.X size={10} />].map((ic, i) => (
            <div key={i} style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSec }}>{ic}</div>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0', fontSize: 12.5 }}>
          <SvcRow theme={t} depth={0} expanded icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />}>Database</SvcRow>
          <SvcRow theme={t} depth={1} expanded icon={<ElephantGlyph size={13} color={SnowyTokens.accent[500]} />}>snowy@dev</SvcRow>
          <SvcRow theme={t} depth={2} selected icon={<Ico.Editor size={12} color={SnowyTokens.accent[500]} />} meta="606 ms">console</SvcRow>
          <SvcRow theme={t} depth={1} expanded icon={<ElephantGlyph size={13} color={SnowyTokens.sem.ok} />}>snowy@local</SvcRow>
          <SvcRow theme={t} depth={2} icon={<Ico.Editor size={12} color={SnowyTokens.accent[500]} />} meta="23 ms">console</SvcRow>
        </div>
      </div>

      {/* Result tabs + data */}
      <ResultsPane theme={t} />
    </div>
  );
}

function SvcRow({ theme, depth = 0, expanded, selected, icon, meta, children }) {
  const t = theme;
  return (
    <div style={{
      height: 22, display: 'flex', alignItems: 'center',
      paddingLeft: 6 + depth * 14, paddingRight: 8, gap: 5,
      background: selected ? t.selected : 'transparent',
      borderLeft: selected ? `2px solid ${t.selectedBorder}` : '2px solid transparent',
      color: t.text, fontSize: 12,
    }}>
      <div style={{ width: 10, color: t.textDim, transform: expanded ? 'rotate(90deg)' : 'none', display: 'flex' }}>
        <Ico.Chevron size={9} />
      </div>
      {icon}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</div>
      {meta && <span style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>{meta}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Results pane — output tabs + grid
function ResultsPane({ theme }) {
  const t = theme;
  const tabs = [
    { icon: <Ico.Editor size={11} color={t.textSec} />, label: 'Output', muted: true },
    { icon: <Ico.Table size={11} color={SnowyTokens.accent[500]} />, label: 'mydatabase.public.users', active: true, pinned: true },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.panel }}>
      {/* Tabs */}
      <div style={{ height: 26, display: 'flex', alignItems: 'stretch', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, fontSize: 11.5, paddingLeft: 6 }}>
        {tabs.map((tab, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
            background: tab.active ? t.panel : 'transparent',
            borderRight: `0.5px solid ${t.border}`,
            borderBottom: tab.active ? `2px solid ${SnowyTokens.accent[500]}` : 'none',
            color: tab.active ? t.text : t.textSec,
            fontFamily: SnowyTokens.font.ui, position: 'relative', top: 0.5,
          }}>
            {tab.icon}
            <span style={{ fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
            {tab.pinned && (
              <div title="Unpin Tab" style={{ color: SnowyTokens.accent[500], transform: 'rotate(35deg)', display: 'flex' }}>
                <Ico.Pin size={11} color={SnowyTokens.accent[500]} />
              </div>
            )}
            <Ico.X size={10} color={t.textDim} />
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: t.textDim }}>
          <Ico.Dots size={12} />
        </div>
      </div>

      {/* Result toolbar */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 1, background: t.chrome, borderBottom: `0.5px solid ${t.divider}` }}>
        <ToolIcon theme={t} icon={<Ico.Grid size={11} />} title="Table view" active />
        <ToolIcon theme={t} icon={<Ico.View size={11} />} title="Chart" />
        <ToolIcon theme={t} icon={<Ico.Refresh size={11} />} title="Reload" />
        <ToolIcon theme={t} icon={<Ico.Stop size={10} />} title="Stop" />
        <Divider theme={t} />
        <ToolIcon theme={t} icon={<Ico.Plus size={11} />} title="Add row" />
        <ToolIcon theme={t} icon={<span style={{ fontSize: 13, lineHeight: 1, fontWeight: 600, color: 'inherit' }}>−</span>} title="Delete row" />
        <ToolIcon theme={t} icon={<Ico.History size={11} />} title="Revert" />
        <ToolIcon theme={t} icon={<Ico.Save size={11} />} title="Submit" />
        <Divider theme={t} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.textSec, padding: '0 8px' }}>
          <span>Tx:</span>
          <span style={{ color: t.text, fontWeight: 500 }}>Auto</span>
          <Ico.ChevronDown size={9} color={t.textDim} />
        </div>
        <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10.5, fontWeight: 700, color: t.textSec, padding: '0 6px', letterSpacing: 0.3 }}>DDL</span>
        <Divider theme={t} />
        {/* Pin tab button — tooltip visible to show affordance */}
        <div style={{ position: 'relative' }}>
          <ToolIcon theme={t} icon={<div style={{ transform: 'rotate(35deg)' }}><Ico.Pin size={11} color={SnowyTokens.accent[500]} /></div>} title="Unpin Tab" active />
          <div style={{
            position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)',
            padding: '3px 8px', background: t.text, color: t.bg,
            fontSize: 10.5, borderRadius: 3, whiteSpace: 'nowrap', zIndex: 5,
            boxShadow: '0 2px 6px rgba(0,0,0,.25)',
          }}>Unpin Tab</div>
        </div>
        <ToolIcon theme={t} icon={<Ico.Search size={11} />} title="Find" />
        <ToolIcon theme={t} icon={<Ico.Sidebar size={11} />} title="Values" />
        <ToolIcon theme={t} icon={<Ico.Grid size={11} />} title="Aggregates" />
        <ToolIcon theme={t} icon={<Ico.Filter size={11} />} title="Filter" />
        <ToolIcon theme={t} icon={<Ico.View size={11} />} title="Geo" />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', fontSize: 11, color: t.textSec }}>
          <span>CSV</span>
          <Ico.ChevronDown size={9} color={t.textDim} />
        </div>
        <ToolIcon theme={t} icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v8M5 8l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>} title="Export" />
        <ToolIcon theme={t} icon={<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 13V5M5 8l3-3 3 3M3 3h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>} title="Import" />
        <ToolIcon theme={t} icon={<Ico.Sort size={11} />} title="Sort" />
        <ToolIcon theme={t} icon={<Ico.View size={11} />} title="View mode" />
        <ToolIcon theme={t} icon={<Ico.Settings size={11} />} title="Settings" />
      </div>

      {/* Grid */}
      <UsersGrid theme={t} />
    </div>
  );
}

function UsersGrid({ theme }) {
  const t = theme;
  const cols = [
    { l: 'user_id',    m: 'int4',    icon: 'pk', w: 110 },
    { l: 'first_name', m: 'varchar', icon: 'txt', w: 140 },
    { l: 'last_name',  m: 'varchar', icon: 'txt', w: 140 },
    { l: 'email',      m: 'varchar', icon: 'txt', w: 240 },
    { l: 'created_at', m: 'timestamptz', icon: 'ts', w: 240 },
  ];
  const rows = [
    [1, 'Alice',   'Smith',   'alice.smith@example.com', '2026-04-24 10:58:08.849523 +00:00'],
    [2, 'Bob',     'Johnson', 'bob.j@provider.net',       '2026-04-24 10:58:08.849523 +00:00'],
    [3, 'Charlie', 'Davis',   'charlie.d@fintech.com',    '2026-04-24 10:58:08.849523 +00:00', true],
  ];
  return (
    <div style={{ flex: 1, overflow: 'hidden', fontFamily: SnowyTokens.font.mono, fontSize: 11.5, background: t.panel }}>
      {/* Header */}
      <div style={{ display: 'flex', background: t.gridHeader, borderBottom: `0.5px solid ${t.borderStrong}`, fontFamily: SnowyTokens.font.ui, color: t.textSec, fontSize: 11 }}>
        <div style={{ width: 36, padding: '5px 6px', textAlign: 'right', borderRight: `0.5px solid ${t.divider}` }}> </div>
        {cols.map((c, i) => (
          <div key={i} style={{ width: c.w, padding: '5px 8px', borderRight: `0.5px solid ${t.divider}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ColGlyph kind={c.icon} color={c.icon === 'pk' ? SnowyTokens.sem.warn : t.textDim} />
            <span style={{ color: t.text, fontWeight: 500, fontFamily: SnowyTokens.font.mono, fontSize: 11 }}>{c.l}</span>
            <Ico.Filter size={9} color={t.textDim} />
            <div style={{ flex: 1 }} />
            <span style={{ color: t.textDim, fontSize: 10 }}>⇅</span>
          </div>
        ))}
      </div>
      {/* Rows */}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', borderBottom: `0.5px solid ${t.divider}`, height: 24, background: i % 2 ? t.gridStripe : 'transparent' }}>
          <div style={{ width: 36, padding: '4px 6px', textAlign: 'right', color: t.textDim, borderRight: `0.5px solid ${t.divider}`, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{i + 1}</div>
          {cols.map((c, j) => {
            const highlighted = j === 1 && r[5]; // Charlie cell selected in screenshot
            return (
              <div key={j} style={{
                width: c.w, padding: '4px 8px', borderRight: `0.5px solid ${t.divider}`,
                color: t.text, display: 'flex', alignItems: 'center',
                justifyContent: j === 0 ? 'flex-end' : 'flex-start',
                background: highlighted ? SnowyTokens.accent[500] : 'transparent',
                fontWeight: j === 0 ? 500 : 400,
                fontVariantNumeric: j === 0 ? 'tabular-nums' : 'normal',
              }}>
                <span style={{ color: highlighted ? '#fff' : (j === 0 ? t.text : t.text) }}>{r[j]}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function ColGlyph({ kind, color }) {
  if (kind === 'pk') {
    return (
      <svg width="12" height="12" viewBox="0 0 16 16">
        <rect x="3" y="4.5" width="10" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3" />
        <circle cx="11" cy="6" r="1.2" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 16 16">
      <rect x="3" y="4.5" width="10" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

function ElephantGlyph({ size = 13, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color} strokeWidth="1.2" fill={color + '22'} />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

function ToolIcon({ theme, icon, title, active, muted, tone }) {
  const t = theme;
  return (
    <div title={title} style={{
      width: 24, height: 24, borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: active ? t.hover : 'transparent',
      color: muted ? t.textDim : (tone || t.textSec),
    }}>{icon}</div>
  );
}

function Divider({ theme }) {
  return <div style={{ width: 1, height: 14, background: theme.border, margin: '0 3px' }} />;
}

function ToolWindowHeader({ theme, tabs, compact, trailingPlus }) {
  const t = theme;
  return (
    <div style={{ height: compact ? 24 : 28, display: 'flex', alignItems: 'stretch', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, fontSize: 11.5, paddingLeft: 2 }}>
      {tabs.map((tab, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
          background: tab.active && !tab.bare ? t.panel : 'transparent',
          borderRight: !tab.bare ? `0.5px solid ${t.border}` : 'none',
          borderBottom: tab.active && !tab.bare ? `2px solid ${SnowyTokens.accent[500]}` : 'none',
          color: tab.active ? t.text : t.textSec,
          fontFamily: SnowyTokens.font.ui, position: 'relative', top: 0.5,
          fontWeight: tab.active ? 600 : 400,
        }}>
          {tab.icon}
          <span>{tab.label}</span>
          {!tab.bare && <Ico.X size={10} color={t.textDim} />}
        </div>
      ))}
      {trailingPlus && (
        <div title="New Query Console ⌘⇧N" data-console-plus style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, alignSelf: 'center', marginLeft: 4, marginTop: 2,
          color: t.textSec, borderRadius: 4,
        }}>
          <Ico.Plus size={11} />
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', color: t.textDim }}>
        <Ico.Dots size={12} />
      </div>
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

function StatusBar({ theme }) {
  const t = theme;
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 14, background: t.chrome, borderTop: `0.5px solid ${t.border}`, fontSize: 10.5, color: t.textSec, fontFamily: SnowyTokens.font.mono, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: SnowyTokens.sem.ok, boxShadow: `0 0 6px ${SnowyTokens.sem.ok}` }} />
        dev-db.internal:5432
      </div>
      <div>mydatabase.public</div>
      <div>utf-8</div>
      <div style={{ flex: 1 }} />
      <div>3 rows · 606 ms</div>
      <div style={{ color: t.textDim }}>Ln 2, Col 12</div>
      <div style={{ color: t.textDim }}>UTC−05:00</div>
    </div>
  );
}

Object.assign(window, { Workspace, ToolbarBtn, StatusBar, ToolWindowHeader, ToolIcon });
