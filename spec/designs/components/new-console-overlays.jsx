// Overlays showing HOW to create a new query console.
// Three entry points demonstrated in one screen.

function NewConsoleOverlays({ theme }) {
  const t = theme;
  return (
    <>
      {/* (A) Right-click context menu on a connection in the tree (sidebar is 280px) */}
      <ContextMenu theme={t} x={200} y={150} />

      {/* (B) Tooltip on sidebar "New query console" toolbar icon — icon sits ~x=135,y=18 in overlay coords */}
      <ToolbarTooltip theme={t} x={125} y={32} />

      {/* (C) '+' new-tab button in the console tab strip */}
      <NewTabHighlight theme={t} />

      {/* (D) Cheat-sheet chip */}
      <ShortcutChip theme={t} />
    </>
  );
}

function ContextMenu({ theme, x, y }) {
  const t = theme;
  const items = [
    { label: 'New', sub: true, icon: <Ico.Plus size={11} />, open: true },
    { label: 'Jump to Query Console…', kbd: '⌘⇧F10', muted: true },
    { label: 'Refresh',                 kbd: '⌘⌥Y',  icon: <Ico.Refresh size={11} /> },
    { sep: true },
    { label: 'Copy Data Source',        kbd: '⌘C' },
    { label: 'Data Source Properties…', kbd: '⌘↵',   icon: <Ico.Database size={11} /> },
    { sep: true },
    { label: 'Disconnect',              icon: <Ico.X size={11} /> },
    { label: 'Delete',                  kbd: '⌫', danger: true },
  ];
  const sub = [
    { label: 'Query Console',  kbd: '⌘⇧N',  icon: <Ico.Editor size={11} color={SnowyTokens.accent[500]} />, hot: true },
    { label: 'Attach Session to…',           icon: <Ico.Enter size={11} /> },
    { sep: true },
    { label: 'Schema…',                      icon: <Ico.Schema size={11} /> },
    { label: 'Table…',                       icon: <Ico.Table size={11} /> },
    { label: 'View…',                        icon: <Ico.View size={11} /> },
    { label: 'Function…',                    icon: <Ico.Function size={11} /> },
    { sep: true },
    { label: 'SQL File…',                    icon: <Ico.Editor size={11} /> },
    { label: 'Scratch File…',     kbd: '⌘⌥⇧Insert' },
  ];
  return (
    <>
      <div style={{
        position: 'absolute', left: x, top: y, zIndex: 40,
        minWidth: 260,
        background: t.panel,
        border: `0.5px solid ${t.borderStrong}`,
        borderRadius: 6,
        boxShadow: t.shadow,
        padding: '4px 0', fontSize: 12, color: t.text,
        fontFamily: SnowyTokens.font.ui,
      }}>
        {items.map((it, i) => it.sep ? (
          <div key={i} style={{ height: 1, background: t.divider, margin: '4px 0' }} />
        ) : (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px',
            background: it.open ? t.selected : 'transparent',
            color: it.muted ? t.textDim : (it.danger ? SnowyTokens.sem.err : t.text),
          }}>
            <div style={{ width: 14, color: t.textSec, display: 'flex', alignItems: 'center' }}>{it.icon}</div>
            <span style={{ flex: 1, fontWeight: it.open ? 500 : 400 }}>{it.label}</span>
            {it.kbd && <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10.5, color: t.textDim }}>{it.kbd}</span>}
            {it.sub && <Ico.Chevron size={10} color={t.textSec} />}
          </div>
        ))}
      </div>
      {/* Submenu — flies out from 'New' */}
      <div style={{
        position: 'absolute', left: x + 260, top: y,
        minWidth: 260, zIndex: 41,
        background: t.panel,
        border: `0.5px solid ${t.borderStrong}`,
        borderRadius: 6,
        boxShadow: t.shadow,
        padding: '4px 0', fontSize: 12, color: t.text,
      }}>
        {sub.map((it, i) => it.sep ? (
          <div key={i} style={{ height: 1, background: t.divider, margin: '4px 0' }} />
        ) : (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px',
            background: it.hot ? t.selected : 'transparent',
            borderLeft: it.hot ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
          }}>
            <div style={{ width: 14, display: 'flex', alignItems: 'center' }}>{it.icon}</div>
            <span style={{ flex: 1, fontWeight: it.hot ? 600 : 400, color: it.hot ? t.text : t.textSec }}>{it.label}</span>
            {it.kbd && <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10.5, color: t.textDim }}>{it.kbd}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function ToolbarTooltip({ theme, x, y }) {
  const t = theme;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 0, height: 0, marginLeft: 10,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderBottom: `5px solid ${t.text}`,
      }} />
      <div style={{
        background: t.text, color: t.bg,
        padding: '5px 9px', borderRadius: 4,
        fontSize: 11, fontFamily: SnowyTokens.font.ui,
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}>
        <span style={{ fontWeight: 500 }}>New Query Console</span>
        <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10, opacity: 0.6 }}>⌘⇧N</span>
      </div>
      <div style={{ fontSize: 10, color: t.textDim, marginTop: 4, marginLeft: 4, fontFamily: SnowyTokens.font.mono }}>bound to selected schema</div>
    </div>
  );
}

function NewTabHighlight({ theme }) {
  const t = theme;
  // Overlay is inside the content-area container (after title bar), so y=0 is the top of the tab strip.
  // Console tab strip: x = 280 (sidebar) + one tab (~185px) + a little gap; y = just inside the tab strip.
  const plusX = 280 + 187 - 5;
  const plusY = 2;
  return (
    <div style={{ position: 'absolute', left: plusX, top: plusY, zIndex: 15, pointerEvents: 'none' }}>
      {/* Ring around + button */}
      <div style={{
        width: 26, height: 26, borderRadius: 6,
        border: `2px solid ${SnowyTokens.accent[500]}`,
        boxShadow: `0 0 0 4px ${SnowyTokens.accent[500]}33, 0 0 16px ${SnowyTokens.accent[500]}55`,
      }} />
      {/* Label tag below */}
      <div style={{
        position: 'absolute', left: -30, top: 36,
        padding: '5px 9px', borderRadius: 4,
        background: SnowyTokens.accent[500], color: '#fff',
        fontSize: 11, fontFamily: SnowyTokens.font.ui, fontWeight: 500,
        boxShadow: '0 2px 8px rgba(0,0,0,.18)',
        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      }}>
        <Ico.Plus size={10} color="#fff" />
        <span>Open new console</span>
      </div>
    </div>
  );
}

function ShortcutChip({ theme }) {
  const t = theme;
  return (
    <div style={{
      position: 'absolute', right: 24, bottom: 48, zIndex: 20,
      padding: '10px 14px',
      background: t.panel,
      border: `0.5px solid ${t.borderStrong}`,
      borderLeft: `3px solid ${SnowyTokens.accent[500]}`,
      borderRadius: 6,
      boxShadow: t.shadow,
      display: 'flex', flexDirection: 'column', gap: 6,
      fontFamily: SnowyTokens.font.ui,
      width: 280,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: t.textDim, textTransform: 'uppercase' }}>Three ways to open a console</div>
      <Kbd theme={t} label="From toolbar" keys={['⌘', '⇧', 'N']} desc="Bound to current schema" />
      <Kbd theme={t} label="Right-click tree" keys={['New', '→', 'Query Console']} mono desc="Bound to clicked object" />
      <Kbd theme={t} label="Tab strip" keys={['＋']} desc="Duplicate of active console" />
      <div style={{ height: 1, background: t.divider, margin: '2px 0' }} />
      <div style={{ fontSize: 11, color: t.textSec, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Ico.Sparkle size={11} color={SnowyTokens.accent[500]} />
        <span>Each console has its own transaction — changes don't leak.</span>
      </div>
    </div>
  );
}

function Kbd({ theme, label, keys, mono, desc }) {
  const t = theme;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
      <div style={{ width: 100, color: t.textSec }}>{label}</div>
      <div style={{ display: 'flex', gap: 3 }}>
        {keys.map((k, i) => (
          <span key={i} style={{
            padding: mono ? '2px 5px' : '1px 5px',
            background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 3,
            fontFamily: SnowyTokens.font.mono, fontSize: 10.5, color: t.text, fontWeight: 500,
            minWidth: 14, textAlign: 'center',
          }}>{k}</span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10, color: t.textDim }}>{desc}</span>
    </div>
  );
}

Object.assign(window, { NewConsoleOverlays });
