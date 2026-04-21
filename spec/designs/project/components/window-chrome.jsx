// macOS window chrome — traffic lights + titlebar + vibrancy

function TrafficLights({ inactive = false }) {
  const base = { width: 12, height: 12, borderRadius: 6, display: 'inline-block' };
  if (inactive) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ ...base, background: '#c8c4bc' }} />
        <span style={{ ...base, background: '#c8c4bc' }} />
        <span style={{ ...base, background: '#c8c4bc' }} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ ...base, background: '#ff5f57', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.15)' }} />
      <span style={{ ...base, background: '#febc2e', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.15)' }} />
      <span style={{ ...base, background: '#28c840', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.15)' }} />
    </div>
  );
}

function WindowShell({ theme, children, title, toolbar }) {
  const t = theme;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.bg,
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: SnowyTokens.font.ui,
      color: t.text,
      fontSize: 13,
      boxShadow: theme === SnowyDark
        ? '0 0 0 0.5px rgba(255,255,255,.08), 0 20px 60px rgba(0,0,0,.5)'
        : '0 0 0 0.5px rgba(0,0,0,.12), 0 20px 60px rgba(0,0,0,.12)',
    }}>
      {children}
    </div>
  );
}

// Unified title bar with traffic lights baked in on the left.
function TitleBar({ theme, children, tabs, activeTab, onTabClick, height = 38 }) {
  const t = theme;
  return (
    <div style={{
      height,
      background: t.chrome,
      borderBottom: `0.5px solid ${t.border}`,
      display: 'flex', alignItems: 'center',
      flexShrink: 0,
      paddingLeft: 14,
      paddingRight: 10,
      gap: 14,
      position: 'relative',
    }}>
      <TrafficLights />
      {children}
    </div>
  );
}

Object.assign(window, { TrafficLights, WindowShell, TitleBar });
