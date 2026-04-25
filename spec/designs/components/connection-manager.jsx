// Connection Manager — DataGrip-style CRUD with proper auth fields.

function ConnectionManager({ theme }) {
  const t = theme;
  const conns = [
    { id: 'dev',   name: 'snowy@dev',   host: 'dev-db.internal',  db: 'mydatabase', env: 'dev',   online: true,  sel: true },
    { id: 'local', name: 'snowy@local', host: '127.0.0.1',        db: 'mydatabase', env: 'local', online: true },
    { id: 'prod',  name: 'snowy@prod',  host: 'prod-db.internal', db: 'ledger',     env: 'prod',  online: false },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, background: t.bg }}>
      {/* Connection list */}
      <div style={{ width: 260, borderRight: `0.5px solid ${t.border}`, background: t.sidebar, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: t.textDim, textTransform: 'uppercase' }}>Data sources</div>
          <div title="Add" style={{ width: 22, height: 22, borderRadius: 4, background: SnowyTokens.accent[500], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico.Plus size={12} color="#fff" /></div>
          <div title="Delete" style={{ width: 22, height: 22, borderRadius: 4, color: t.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico.X size={11} /></div>
          <div title="Duplicate" style={{ width: 22, height: 22, borderRadius: 4, color: t.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico.Sidebar size={11} /></div>
        </div>
        <div style={{ flex: 1, padding: '0 4px' }}>
          {conns.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              background: c.sel ? t.selected : 'transparent',
              borderLeft: c.sel ? `2px solid ${t.selectedBorder}` : '2px solid transparent',
              marginBottom: 1,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16">
                <path d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
                  stroke={c.online ? SnowyTokens.accent[500] : t.textDim} strokeWidth="1.2"
                  fill={c.online ? SnowyTokens.accent[500] + '22' : 'none'} />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: c.sel ? 600 : 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>{c.host}</div>
              </div>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: c.online ? SnowyTokens.sem.ok : t.textDim, boxShadow: c.online ? `0 0 4px ${SnowyTokens.sem.ok}` : 'none' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: `0.5px solid ${t.divider}`, background: t.panel, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 16 16">
            <path d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6" stroke={SnowyTokens.accent[500]} strokeWidth="1.2" fill={SnowyTokens.accent[500] + '22'} />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text, letterSpacing: -0.3, fontFamily: SnowyTokens.font.display }}>snowy@dev</div>
          <div style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: SnowyTokens.sem.ok + '22', color: SnowyTokens.sem.ok, letterSpacing: 0.4, textTransform: 'uppercase' }}>Development</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>PostgreSQL 16.2 · last connected 2m ago</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: `0.5px solid ${t.divider}`, background: t.panel }}>
          {['General', 'Options', 'SSH/SSL', 'Schemas', 'Advanced'].map((tab, i) => (
            <div key={tab} style={{
              padding: '10px 14px', fontSize: 12,
              color: i === 0 ? t.text : t.textSec,
              fontWeight: i === 0 ? 600 : 400,
              borderBottom: i === 0 ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
              marginBottom: -0.5,
            }}>{tab}</div>
          ))}
        </div>

        {/* Form body */}
        <div style={{ flex: 1, padding: '20px 24px', overflow: 'hidden', background: t.panel, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Row 1: Name + comment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
            <Field theme={t} label="Name" value="snowy@dev" />
            <Field theme={t} label="Comment" value="Shared dev Postgres — reset nightly" muted />
          </div>

          <SectionLabel theme={t}>Connection</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <Field theme={t} label="Host" value="dev-db.internal" mono />
            <Field theme={t} label="Port" value="5432" mono />
            <Field theme={t} label="Database" value="mydatabase" mono />
          </div>

          <SectionLabel theme={t}>Authentication</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Label theme={t}>Auth</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 12, color: t.text, justifyContent: 'space-between' }}>
                <span>User &amp; Password</span>
                <Ico.ChevronDown size={10} color={t.textDim} />
              </div>
              <div style={{ fontSize: 10.5, color: t.textDim }}>Also: No auth · pgpass · IAM · Kerberos/GSSAPI</div>
            </div>
            <Field theme={t} label="User" value="snowy_dev" mono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Label theme={t}>
                <span>Password</span>
                <span style={{ color: SnowyTokens.sem.err, marginLeft: 3 }}>*</span>
              </Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: t.panelAlt, border: `0.5px solid ${SnowyTokens.accent[500]}`, borderRadius: 4, boxShadow: `0 0 0 2px ${SnowyTokens.accent[500]}22` }}>
                <Ico.Lock size={11} color={t.textSec} />
                <span style={{ flex: 1, fontSize: 13, color: t.text, letterSpacing: 2, fontFamily: SnowyTokens.font.mono }}>••••••••••••</span>
                <div title="Show" style={{ color: t.textDim, display: 'flex' }}><Ico.View size={12} /></div>
                <div style={{ width: 1, height: 14, background: t.border }} />
                <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>16 chars</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: t.textSec, marginTop: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: SnowyTokens.accent[500], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico.Check size={9} color="#fff" />
                  </div>
                  Save password
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, border: `1px solid ${t.borderStrong}`, background: t.panelAlt }} />
                  Ask every time
                </label>
                <span style={{ color: t.textDim }}>· stored in macOS Keychain</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Label theme={t}>URL</Label>
              <div style={{ padding: '7px 10px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 4, fontFamily: SnowyTokens.font.mono, fontSize: 11.5, color: t.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                jdbc:postgresql://dev-db.internal:5432/mydatabase
              </div>
              <div style={{ fontSize: 10.5, color: t.textDim }}>Driver: PostgreSQL · JDBC</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 24px', borderTop: `0.5px solid ${t.divider}`, background: t.chrome, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: '5px 12px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 12, color: t.text, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ico.Wifi size={11} color={SnowyTokens.sem.ok} /> Test Connection
          </div>
          <div style={{ fontSize: 11, color: SnowyTokens.sem.ok, fontFamily: SnowyTokens.font.mono, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Ico.Check size={11} color={SnowyTokens.sem.ok} /> Succeeded — 48 ms
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: '5px 12px', border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 12, color: t.textSec }}>Cancel</div>
          <div style={{ padding: '5px 12px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 12, color: t.text }}>Apply</div>
          <div style={{ padding: '5px 16px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>OK</div>
        </div>
      </div>
    </div>
  );
}

function Label({ theme, children }) {
  return <label style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, color: theme.textDim, textTransform: 'uppercase' }}>{children}</label>;
}

function SectionLabel({ theme, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: SnowyTokens.accent[500], textTransform: 'uppercase' }}>{children}</div>
      <div style={{ flex: 1, height: 1, background: theme.divider }} />
    </div>
  );
}

function Field({ theme, label, value, mono, muted }) {
  const t = theme;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Label theme={t}>{label}</Label>
      <div style={{
        padding: '7px 10px',
        background: t.panelAlt,
        border: `0.5px solid ${t.border}`,
        borderRadius: 4,
        fontSize: 12,
        color: muted ? t.textSec : t.text,
        fontFamily: mono ? SnowyTokens.font.mono : SnowyTokens.font.ui,
      }}>{value}</div>
    </div>
  );
}

Object.assign(window, { ConnectionManager });
