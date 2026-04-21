// Connection Manager — CRUD-focused.
// Left: projects (add/rename/delete). Right: connection form + list with
// explicit Edit/Duplicate/Delete per connection. Add Connection dialog floats
// over the list.

function ConnectionManager({ theme }) {
  const t = theme;
  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, background: t.bg }}>
      {/* Projects column */}
      <div style={{ width: 240, borderRight: `0.5px solid ${t.border}`, background: t.sidebar, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: t.textDim, textTransform: 'uppercase' }}>Projects</div>
          <div style={{ padding: '2px 6px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 4, fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Ico.Plus size={10} color="#fff" /> New
          </div>
        </div>
        <div style={{ flex: 1, padding: '0 6px' }}>
          {SnowyData.projects.map((p, i) => (
            <div key={p.id} className="snowy-proj" style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
              background: i === 0 ? t.selected : 'transparent',
              borderLeft: i === 0 ? `2px solid ${t.selectedBorder}` : '2px solid transparent',
              marginBottom: 2,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: t.text, fontWeight: i === 0 ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>{p.connections.length} connection{p.connections.length !== 1 ? 's' : ''}</div>
              </div>
              {i === 0 && <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.hover, color: t.textSec }}><Ico.Settings size={11} /></div>
                <div style={{ width: 18, height: 18, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.hover, color: SnowyTokens.sem.err }}><Ico.X size={11} /></div>
              </div>}
            </div>
          ))}
        </div>
      </div>

      {/* Right — connections for selected project */}
      <div style={{ flex: 1, padding: '24px 28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: SnowyData.projects[0].color }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: -0.4, fontFamily: SnowyTokens.font.display }}>Ledger Core</div>
          <div style={{ fontSize: 12, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>3 connections</div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 500 }}>
            <Ico.Plus size={11} color="#fff" /> Add connection
          </div>
        </div>

        {/* Connection list — table-style with inline actions */}
        <div style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, background: t.panel, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '7px 14px', background: t.chrome, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, color: t.textDim, textTransform: 'uppercase', borderBottom: `0.5px solid ${t.border}` }}>
            <div style={{ width: 16 }} />
            <div style={{ flex: 1.4 }}>Name</div>
            <div style={{ flex: 1.6 }}>Host</div>
            <div style={{ flex: 1.2 }}>Database</div>
            <div style={{ width: 64 }}>Env</div>
            <div style={{ width: 140, textAlign: 'right' }}>Actions</div>
          </div>
          {SnowyData.projects[0].connections.map((c, i) => {
            const envCol = { prod: SnowyTokens.sem.err, dev: SnowyTokens.sem.ok, local: SnowyTokens.accent[500] }[c.env] || t.textSec;
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < 2 ? `0.5px solid ${t.divider}` : 'none', background: i === 0 ? t.selected : 'transparent', borderLeft: i === 0 ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent', fontSize: 12.5 }}>
                <div style={{ width: 16 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: c.status === 'online' ? SnowyTokens.sem.ok : t.textDim, boxShadow: c.status === 'online' ? `0 0 6px ${SnowyTokens.sem.ok}` : 'none' }} />
                </div>
                <div style={{ flex: 1.4, fontWeight: 600, color: t.text }}>{c.name}</div>
                <div style={{ flex: 1.6, fontFamily: SnowyTokens.font.mono, fontSize: 11.5, color: t.textSec }}>{c.host}:5432</div>
                <div style={{ flex: 1.2, fontFamily: SnowyTokens.font.mono, fontSize: 11.5, color: t.textSec }}>{c.db}</div>
                <div style={{ width: 64 }}>
                  <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: envCol + '22', color: envCol, letterSpacing: 0.5, textTransform: 'uppercase' }}>{c.env}</div>
                </div>
                <div style={{ width: 140, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <div style={{ padding: '3px 8px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>Connect</div>
                  <div title="Edit" style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.panelAlt, border: `0.5px solid ${t.border}`, color: t.textSec }}><Ico.Settings size={12} /></div>
                  <div title="Duplicate" style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.panelAlt, border: `0.5px solid ${t.border}`, color: t.textSec }}><Ico.Plus size={11} /></div>
                  <div title="Delete" style={{ width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.panelAlt, border: `0.5px solid ${t.border}`, color: SnowyTokens.sem.err }}><Ico.X size={11} /></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit form for selected connection (production) */}
        <div style={{ border: `0.5px solid ${t.border}`, borderRadius: 8, background: t.panel, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: t.chrome, borderBottom: `0.5px solid ${t.border}`, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico.Settings size={12} color={t.textSec} />
            Editing · <span style={{ color: SnowyTokens.accent[500] }}>production</span>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10.5, color: t.textDim, fontFamily: SnowyTokens.font.mono }}>Last connected 2m ago</div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, padding: '0 14px', borderBottom: `0.5px solid ${t.divider}`, background: t.panel }}>
            {['General', 'SSH / TLS', 'Schemas', 'Advanced'].map((tab, i) => (
              <div key={tab} style={{
                padding: '8px 12px',
                fontSize: 11.5,
                fontWeight: i === 0 ? 600 : 500,
                color: i === 0 ? t.text : t.textSec,
                borderBottom: i === 0 ? `2px solid ${SnowyTokens.accent[500]}` : '2px solid transparent',
                marginBottom: -1,
              }}>{tab}</div>
            ))}
          </div>

          {/* General tab content */}
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '120px 1fr 72px 1fr', gap: '10px 12px', alignItems: 'center' }}>
            {/* Name */}
            <label style={fieldLabel(t)}>Name</label>
            <div style={{ ...fieldInput(t), gridColumn: 'span 3' }}>production</div>

            {/* Host + Port */}
            <label style={fieldLabel(t)}>Host</label>
            <div style={{ ...fieldInput(t), fontFamily: SnowyTokens.font.mono }}>prod-db.internal</div>
            <label style={fieldLabel(t)}>Port</label>
            <div style={{ ...fieldInput(t), fontFamily: SnowyTokens.font.mono }}>5432</div>

            {/* Database */}
            <label style={fieldLabel(t)}>Database</label>
            <div style={{ ...fieldInput(t), gridColumn: 'span 3', fontFamily: SnowyTokens.font.mono }}>ledger_prod</div>

            {/* Authentication */}
            <label style={fieldLabel(t)}>Authentication</label>
            <div style={{ ...fieldInput(t), gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 6 }}>
              User &amp; Password
              <div style={{ flex: 1 }} />
              <Ico.Chevron size={10} color={t.textDim} />
            </div>

            {/* User */}
            <label style={fieldLabel(t)}>User</label>
            <div style={{ ...fieldInput(t), gridColumn: 'span 3', fontFamily: SnowyTokens.font.mono }}>snowy_ro</div>

            {/* Password */}
            <label style={fieldLabel(t)}>Password</label>
            <div style={{ gridColumn: 'span 3', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ ...fieldInput(t), flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontFamily: SnowyTokens.font.mono, color: t.textSec }}>
                <span style={{ letterSpacing: 3, fontSize: 14, lineHeight: '12px' }}>••••••••••••</span>
                <div style={{ flex: 1 }} />
                <div title="Reveal" style={{ width: 20, height: 20, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textDim }}>
                  <Ico.Eye size={12} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 160 }}>
                <label style={{ fontSize: 9.5, color: t.textDim, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Save</label>
                <div style={{ ...fieldInput(t), display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ico.Lock size={10} color={SnowyTokens.accent[500]} />
                  Keychain (forever)
                  <div style={{ flex: 1 }} />
                  <Ico.Chevron size={10} color={t.textDim} />
                </div>
              </div>
            </div>

            {/* SSL mode */}
            <label style={fieldLabel(t)}>SSL mode</label>
            <div style={{ ...fieldInput(t), gridColumn: 'span 3', fontFamily: SnowyTokens.font.mono, display: 'flex', alignItems: 'center', gap: 8 }}>
              require
              <div style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9.5, fontWeight: 700, background: SnowyTokens.sem.ok + '22', color: SnowyTokens.sem.ok, letterSpacing: 0.4 }}>TLS</div>
              <div style={{ flex: 1 }} />
              <Ico.Chevron size={10} color={t.textDim} />
            </div>

            {/* URL (derived) */}
            <label style={fieldLabel(t)}>URL</label>
            <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ ...fieldInput(t), fontFamily: SnowyTokens.font.mono, fontSize: 11, color: t.textSec }}>
                postgres://snowy_ro:••••@prod-db.internal:5432/ledger_prod?sslmode=require
              </div>
              <div style={{ fontSize: 10, color: t.textDim, fontStyle: 'italic' }}>Derived from fields above. Edit directly to override.</div>
            </div>
          </div>

          {/* Test connection result */}
          <div style={{ margin: '0 14px 12px', padding: '7px 10px', background: SnowyTokens.sem.ok + '14', border: `0.5px solid ${SnowyTokens.sem.ok}55`, borderRadius: 5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: SnowyTokens.sem.ok, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</div>
            <span style={{ color: t.text, fontWeight: 600 }}>Connection succeeded</span>
            <span style={{ color: t.textSec, fontFamily: SnowyTokens.font.mono, fontSize: 11 }}>PostgreSQL 16.2 · 184ms · ledger_prod · utf8</span>
          </div>

          <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${t.divider}`, display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ padding: '4px 10px', background: t.panelAlt, border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 11.5, color: t.textSec, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Ico.Wifi size={11} color={SnowyTokens.sem.ok} /> Test connection
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ padding: '4px 10px', border: `0.5px solid ${t.border}`, borderRadius: 4, fontSize: 11.5, color: t.textSec }}>Cancel</div>
            <div style={{ padding: '4px 12px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>Save changes</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ConnectionManager });
