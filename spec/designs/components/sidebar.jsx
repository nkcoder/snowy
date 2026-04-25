// Snowy sidebar — DataGrip-style flat tree.
// Root: list of connections (no projects). Each connection expands to:
//   database → schema (public) → tables/sequences/Database Objects/virtual views
// Selected table expands to columns/keys/foreign keys/indexes/checks.

function SnowySidebar({ theme, activeConnId = 'dev', selectedSchema = 'public', selectedTable = 'transactions', expandTable = false }) {
  const t = theme;
  return (
    <div style={{
      width: 280, background: t.sidebar,
      borderRight: `0.5px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Toolbar */}
      <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 2, borderBottom: `0.5px solid ${t.divider}`, background: t.chrome }}>
        {[
          { i: <Ico.Plus size={14} />, title: 'New' },
          { i: <Ico.Database size={14} />, title: 'Data source properties' },
          { i: <Ico.Refresh size={14} />, title: 'Synchronize' },
          { i: <Ico.Stop size={12} />, title: 'Stop', c: SnowyTokens.sem.err },
          { sep: true },
          { i: <Ico.Editor size={14} />, title: 'New query console ⌘⇧N', badge: true, c: SnowyTokens.accent[500] },
          { i: <Ico.Table size={14} />, title: 'Jump to table' },
          { i: <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>DDL</span>, title: 'Show DDL' },
          { i: <Ico.Split size={13} />, title: 'Diagram' },
          { i: <Ico.View size={14} />, title: 'Preview' },
        ].map((b, i) => b.sep
          ? <div key={i} style={{ width: 1, height: 14, background: t.border, margin: '0 4px' }} />
          : (
            <div key={i} title={b.title} style={{ position: 'relative', width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: b.c || t.textSec }}>
              {b.i}
              {b.badge && (
                <div style={{
                  position: 'absolute', right: -1, bottom: -1,
                  width: 9, height: 9, borderRadius: 5,
                  background: SnowyTokens.accent[500], color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800, lineHeight: 1,
                  border: `1.2px solid ${t.chrome}`,
                }}>+</div>
              )}
            </div>
          )
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: `0.5px solid ${t.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 4 }}>
          <Ico.Search size={11} color={t.textDim} />
          <div style={{ color: t.textDim, fontSize: 11.5, flex: 1 }}>Filter objects…</div>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10, color: t.textDim }}>⌘F</span>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0', fontSize: 12.5 }}>
        <ConnectionNode theme={t} id="dev"   name="snowy@dev"   color={SnowyTokens.accent[500]} activeId={activeConnId} selectedSchema={selectedSchema} selectedTable={selectedTable} expandTable={expandTable} />
        <ConnectionNode theme={t} id="local" name="snowy@local" color={SnowyTokens.sem.ok}     activeId={activeConnId} selectedSchema={null} selectedTable={null} expandTable={false} collapsed />
        <ConnectionNode theme={t} id="prod"  name="snowy@prod"  color={SnowyTokens.sem.err}    activeId={activeConnId} collapsedDeep />
      </div>
    </div>
  );
}

// ─ Row primitive ────────────────────────────────────────────
function Row({ theme, depth = 0, expanded, hasChildren = true, icon, children, badge, meta, selected, small = false }) {
  const t = theme;
  return (
    <div style={{
      height: small ? 22 : 24,
      display: 'flex', alignItems: 'center',
      paddingLeft: 6 + depth * 14, paddingRight: 8,
      background: selected ? t.selected : 'transparent',
      borderLeft: selected ? `2px solid ${t.selectedBorder}` : '2px solid transparent',
      color: t.text, gap: 4, fontSize: small ? 11.5 : 12.5,
      fontWeight: selected ? 600 : 400,
    }}>
      {hasChildren
        ? <div style={{ width: 10, color: t.textDim, transform: expanded ? 'rotate(90deg)' : 'none', display: 'flex', transition: 'transform .1s' }}><Ico.Chevron size={9} /></div>
        : <div style={{ width: 10 }} />}
      {icon && <div style={{ display: 'flex', alignItems: 'center' }}>{icon}</div>}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</div>
      {meta !== undefined && meta !== null && meta !== '' && (
        <span style={{ fontSize: 10.5, color: t.textDim, fontVariantNumeric: 'tabular-nums', fontFamily: SnowyTokens.font.mono }}>{meta}</span>
      )}
      {badge && <span style={{ padding: '0 6px', borderRadius: 10, fontSize: 10, color: t.textSec, background: t.panelAlt, border: `0.5px solid ${t.border}`, fontWeight: 500 }}>{badge}</span>}
    </div>
  );
}

// Elephant glyph for Postgres
function ElephantIcon({ size = 14, color, inactive }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={inactive ? 'none' : color + '22'} />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

// ─ Connection node ──────────────────────────────────────────
function ConnectionNode({ theme, id, name, color, activeId, selectedSchema, selectedTable, expandTable, collapsed, collapsedDeep }) {
  const t = theme;
  const isActive = id === activeId;
  const expanded = isActive || (!collapsed && !collapsedDeep);
  const offline = id === 'prod';
  return (
    <div>
      <Row theme={t} depth={0} expanded={expanded}
        icon={<ElephantIcon size={15} color={color} inactive={offline} />}
        badge="1 of 2">
        <span style={{ fontWeight: 600 }}>{name}</span>
        {offline && <span style={{ color: t.textDim, fontSize: 10.5, marginLeft: 6 }}>disconnected</span>}
      </Row>
      {expanded && !collapsedDeep && (
        <>
          <Row theme={t} depth={1} expanded={isActive}
            icon={<Ico.Database size={12} color={t.textSec} />}
            badge="1 of 3">
            mydatabase
          </Row>
          {isActive && (
            <SchemaNode theme={t} name="public" expanded selectedTable={selectedTable} expandTable={expandTable} selected={selectedSchema === 'public' && !selectedTable} />
          )}
          {!isActive && (
            <Row theme={t} depth={2} expanded={false}
              icon={<Ico.Schema size={12} color={t.textSec} />}>
              public
            </Row>
          )}
        </>
      )}
    </div>
  );
}

// ─ Schema node (public) ─────────────────────────────────────
function SchemaNode({ theme, name, expanded, selectedTable, expandTable, selected }) {
  const t = theme;
  return (
    <>
      <Row theme={t} depth={2} expanded={expanded}
        icon={<Ico.Schema size={12} color={SnowyTokens.accent[500]} />}
        selected={selected}>
        {name}
      </Row>
      {expanded && <TablesFolder theme={t} selectedTable={selectedTable} expandTable={expandTable} />}
      {expanded && (
        <Row theme={t} depth={3} hasChildren
          icon={<Ico.Folder size={12} color={SnowyTokens.sem.warn} />}
          meta="4">
          sequences
        </Row>
      )}
    </>
  );
}

function TablesFolder({ theme, selectedTable, expandTable }) {
  const t = theme;
  const tables = [
    { name: 'accounts',     rows: '1.24M' },
    { name: 'audit_logs',   rows: '312M' },
    { name: 'transactions', rows: '84.3M' },
    { name: 'users',        rows: '8.9K' },
  ];
  return (
    <>
      <Row theme={t} depth={3} expanded
        icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />}
        meta="4">
        tables
      </Row>
      {tables.map((tb) => {
        const isSel = tb.name === selectedTable;
        return (
          <React.Fragment key={tb.name}>
            <Row theme={t} depth={4} expanded={isSel && expandTable} hasChildren={true}
              icon={<Ico.Table size={12} color={t.textSec} />}
              selected={isSel && !expandTable}>
              <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>{tb.name}</span>
            </Row>
            {isSel && expandTable && <TableInternals theme={t} tableName={tb.name} />}
          </React.Fragment>
        );
      })}
    </>
  );
}

function TableInternals({ theme, tableName }) {
  const t = theme;
  const cols = [
    { name: 'account_id',   type: 'integer',                 key: 'pk',  dflt: 'nextval(…)' },
    { name: 'user_id',      type: 'integer',                 key: 'fk' },
    { name: 'account_type', type: 'varchar(20)' },
    { name: 'balance',      type: 'numeric(15,2)',           dflt: '0.00' },
    { name: 'currency',     type: "varchar(3)",              dflt: "'USD'" },
    { name: 'status',       type: 'varchar(15)',             dflt: "'active'" },
    { name: 'updated_at',   type: 'timestamp with time zone' },
  ];
  return (
    <>
      <Row theme={t} depth={5} expanded
        icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />}
        meta="7">
        columns
      </Row>
      {cols.map((c) => (
        <Row key={c.name} theme={t} depth={6} hasChildren={false} small
          icon={<ColIcon theme={t} kind={c.key} />}>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11, color: t.text, fontWeight: 500 }}>{c.name}</span>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10.5, color: t.textDim, marginLeft: 8 }}>
            {c.type}{c.dflt ? <span> = <span style={{ color: SnowyTokens.sem.ok }}>{c.dflt}</span></span> : null}
          </span>
        </Row>
      ))}
      <Row theme={t} depth={5} hasChildren icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />} meta="1">keys</Row>
      <Row theme={t} depth={5} hasChildren icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />} meta="1">foreign keys</Row>
      <Row theme={t} depth={5} hasChildren icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />} meta="1">indexes</Row>
      <Row theme={t} depth={5} hasChildren icon={<Ico.Folder size={12} color={SnowyTokens.accent[500]} />} meta="1">checks</Row>
    </>
  );
}

function ColIcon({ theme, kind }) {
  // Small column-type glyph matching DataGrip
  const t = theme;
  if (kind === 'pk') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16">
        <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={SnowyTokens.sem.warn} strokeWidth="1.3" />
        <circle cx="11" cy="5.5" r="1.4" fill={SnowyTokens.sem.warn} />
      </svg>
    );
  }
  if (kind === 'fk') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16">
        <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={SnowyTokens.accent[500]} strokeWidth="1.3" />
        <path d="M10 5.5l2.5 2.5L10 10.5" stroke={SnowyTokens.accent[500]} strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16">
      <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={t.textDim} strokeWidth="1.3" />
    </svg>
  );
}

Object.assign(window, { SnowySidebar });
