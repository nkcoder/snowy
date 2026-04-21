// Snowy sidebar — FLAT hierarchy.
// Project group header → Connection (hosts many DBs, but one DB per conn here)
// → 4 fixed folders: schemas · queries · views · reports  ← peers, at same depth
// Tables/Views live directly under schemas (one level deeper, leaf).
// Reports/Exports are collapsed by default (lower priority).

function SnowySidebar({ theme, activeConn = 'ledger/prod', selectedTable = 'transactions', showActions = false }) {
  const t = theme;
  return (
    <div style={{
      width: 260,
      background: t.sidebar,
      borderRight: `0.5px solid ${t.border}`,
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Search + connection switcher */}
      <div style={{ padding: '8px 10px 6px', borderBottom: `0.5px solid ${t.divider}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: t.panel, border: `0.5px solid ${t.border}`, borderRadius: 5 }}>
          <Ico.Search size={12} color={t.textDim} />
          <div style={{ color: t.textDim, fontSize: 12, flex: 1 }}>Find anything…</div>
          <span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 10, color: t.textDim, padding: '1px 4px', background: t.hover, borderRadius: 3 }}>⌘K</span>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '6px 0', fontSize: 12.5 }}>
        {SnowyData.projects.map((proj) => (
          <Project key={proj.id} proj={proj} theme={t} activeConn={activeConn} selectedTable={selectedTable} showActions={showActions} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', borderTop: `0.5px solid ${t.divider}`, display: 'flex', alignItems: 'center', gap: 6, color: t.textSec, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: SnowyTokens.accent[500], color: '#fff', borderRadius: 4, fontWeight: 500 }}>
          <Ico.Plus size={11} color="#fff" /> New connection
        </div>
        <div style={{ flex: 1 }} />
        <Ico.Settings size={13} color={t.textDim} />
      </div>
    </div>
  );
}

function TreeRow({ theme, depth, expanded, icon, label, meta, selected, selectedBorderColor, hasChildren = true, badge, dim = false, bold = false, uppercase = false, small = false, actions }) {
  const t = theme;
  const pad = 6 + depth * 12;
  const bg = selected ? t.selected : 'transparent';
  return (
    <div className="snowy-row" style={{
      height: small ? 22 : 24,
      display: 'flex', alignItems: 'center',
      paddingLeft: pad, paddingRight: 8,
      background: bg,
      borderLeft: selected ? `2px solid ${selectedBorderColor || t.selectedBorder}` : '2px solid transparent',
      color: dim ? t.textDim : t.text,
      gap: 4,
      fontSize: small ? 10.5 : 12.5,
      fontWeight: bold ? 600 : (selected ? 600 : 400),
      letterSpacing: uppercase ? 0.4 : 0,
      textTransform: uppercase ? 'uppercase' : 'none',
      position: 'relative',
    }}>
      {hasChildren ? (
        <div style={{ width: 12, display: 'flex', alignItems: 'center', color: t.textDim, transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
          <Ico.Chevron size={9} />
        </div>
      ) : <div style={{ width: 12 }} />}
      {icon && <div style={{ display: 'flex', alignItems: 'center', color: t.textSec }}>{icon}</div>}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      {meta && <div style={{ fontSize: 10.5, color: t.textDim, fontVariantNumeric: 'tabular-nums', fontFamily: SnowyTokens.font.mono }}>{meta}</div>}
      {badge}
      {actions}
    </div>
  );
}

function RowActions({ theme, items = ['edit', 'del'] }) {
  const t = theme;
  const map = {
    add:  { icon: <Ico.Plus size={10} />,     title: 'Add' },
    edit: { icon: <Ico.Settings size={10} />, title: 'Edit' },
    del:  { icon: <Ico.X size={10} />,        title: 'Delete', color: SnowyTokens.sem.err },
    run:  { icon: <Ico.Play size={9} />,      title: 'Run',    color: SnowyTokens.sem.ok },
  };
  return (
    <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
      {items.map((k) => (
        <div key={k} title={map[k].title} style={{
          width: 16, height: 16, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: t.hover, color: map[k].color || t.textSec,
        }}>{map[k].icon}</div>
      ))}
    </div>
  );
}

function Project({ proj, theme, activeConn, selectedTable, showActions }) {
  const t = theme;
  return (
    <div style={{ marginBottom: 4 }}>
      {/* Project header — CRUD affordances on hover (shown by default here) */}
      <div style={{ height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, color: t.textDim, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        <Ico.ChevronDown size={9} />
        <div style={{ width: 7, height: 7, borderRadius: 2, background: proj.color }} />
        <span style={{ color: t.textSec }}>{proj.name}</span>
        <span style={{ color: t.textDim, fontFamily: SnowyTokens.font.mono, fontSize: 9.5, letterSpacing: 0, textTransform: 'none' }}>· {proj.connections.length}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, opacity: .8 }}>
          <div title="Add connection" style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSec }}><Ico.Plus size={10} /></div>
          <div title="Rename project" style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textDim }}><Ico.Dots size={10} /></div>
        </div>
      </div>

      {proj.connections.map((c) => {
        const isActiveProj = `${proj.id}/${c.id}` === activeConn;
        const envCol = { prod: SnowyTokens.sem.err, dev: SnowyTokens.sem.ok, stg: SnowyTokens.sem.warn, local: SnowyTokens.accent[500] }[c.env] || t.textSec;
        return (
          <div key={c.id}>
            <TreeRow theme={t} depth={0} expanded={isActiveProj}
              icon={<Ico.Database size={13} color={isActiveProj ? SnowyTokens.accent[500] : envCol} />}
              label={<span>
                <span style={{ color: isActiveProj ? t.text : t.textSec }}>{c.name}</span>
                <span style={{ color: t.textDim, fontFamily: SnowyTokens.font.mono, fontSize: 10.5, marginLeft: 6 }}>{c.db}</span>
              </span>}
              selected={isActiveProj}
              selectedBorderColor={SnowyTokens.accent[500]}
              badge={<div style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 700, background: envCol + '22', color: envCol, letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: SnowyTokens.font.ui }}>{c.env}</div>}
              actions={isActiveProj ? <RowActions theme={t} items={['edit', 'del']} /> : null}
            />
            {isActiveProj && (
              <>
                {/* Flat peers: queries · schemas · views · reports */}
                <QueriesFolder theme={t} />
                <SchemasFolder theme={t} selectedTable={selectedTable} />
                <ViewsFolder theme={t} />
                <ReportsFolder theme={t} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FLAT FOLDER COMPONENTS (all same depth under the connection) ──

function QueriesFolder({ theme }) {
  const t = theme;
  const queries = [
    { n: 'daily_pnl.sql',        dirty: true,  sel: true },
    { n: 'recon_breaks.sql' },
    { n: 'stuck_settlements.sql' },
    { n: 'top_counterparties.sql' },
    { n: 'fx_exposure.sql' },
    { n: 'audit_admin_writes.sql' },
  ];
  return (
    <div>
      <TreeRow theme={t} depth={1} expanded bold
        icon={<Ico.Editor size={12} color={SnowyTokens.sem.warn} />}
        label="queries" meta={queries.length}
        actions={<RowActions theme={t} items={['add']} />}
      />
      {queries.map((q, i) => (
        <div key={q.n} style={{ position: 'relative' }} className="snowy-query">
          <TreeRow theme={t} depth={2} hasChildren={false}
            icon={<Ico.Editor size={11} color={q.dirty ? SnowyTokens.sem.warn : t.textDim} />}
            label={<span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>{q.n}</span>}
            selected={q.sel}
            badge={q.dirty ? <div style={{ width: 5, height: 5, borderRadius: 3, background: SnowyTokens.sem.warn }} /> : null}
            actions={q.sel ? <RowActions theme={t} items={['run', 'edit', 'del']} /> : null}
          />
        </div>
      ))}
    </div>
  );
}

function SchemasFolder({ theme, selectedTable }) {
  const t = theme;
  return (
    <div>
      <TreeRow theme={t} depth={1} expanded bold
        icon={<Ico.Schema size={12} color={SnowyTokens.accent[500]} />}
        label="schemas" meta={SnowyData.schemas.length}
      />
      {SnowyData.schemas.slice(0, 3).map((sc) => (
        <div key={sc.name}>
          <TreeRow theme={t} depth={2} expanded={sc.name === 'public' || sc.name === 'finance'}
            icon={<Ico.Schema size={11} color={t.textSec} />}
            label={sc.name} meta={sc.tables.length}
          />
          {(sc.name === 'public' || sc.name === 'finance') && sc.tables.map((tb) => (
            <TreeRow key={tb.name} theme={t} depth={3} hasChildren={false}
              icon={<Ico.Table size={11} color={tb.mat ? SnowyTokens.sem.purple : tb.hot ? SnowyTokens.accent[500] : t.textDim} />}
              label={<span style={{ fontFamily: SnowyTokens.font.mono, fontSize: 11.5 }}>{tb.name}</span>}
              meta={tb.rows}
              selected={sc.name === 'public' && tb.name === selectedTable}
            />
          ))}
        </div>
      ))}
      {SnowyData.schemas.length > 3 && (
        <div style={{ padding: '2px 0 2px 42px', color: t.textDim, fontSize: 10.5, fontFamily: SnowyTokens.font.mono }}>+ {SnowyData.schemas.length - 3} more schemas</div>
      )}
    </div>
  );
}

function ViewsFolder({ theme }) {
  const t = theme;
  return (
    <div>
      <TreeRow theme={t} depth={1} expanded={false}
        icon={<Ico.View size={12} color={t.textSec} />}
        label={<span style={{ color: t.textSec }}>views</span>}
        meta="12"
        dim
      />
    </div>
  );
}

function ReportsFolder({ theme }) {
  const t = theme;
  return (
    <>
      <TreeRow theme={t} depth={1} expanded={false} hasChildren
        icon={<Ico.Dash size={11} color={t.textDim} />}
        label={<span style={{ color: t.textDim }}>reports</span>}
        meta="4"
        dim
      />
      <TreeRow theme={t} depth={1} expanded={false} hasChildren
        icon={<Ico.Arrow size={11} color={t.textDim} />}
        label={<span style={{ color: t.textDim }}>exports</span>}
        dim
      />
    </>
  );
}

Object.assign(window, { SnowySidebar });
