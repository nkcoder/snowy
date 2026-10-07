import { HighlightStyle, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, type Rect, tooltips } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { SYNTAX, T } from './tokens';

// DataGrip-inspired syntax colors, sourced from SYNTAX tokens — overrides
// oneDark via Prec.high. Colours are lexical (Lezer SQL grammar tags): keyword,
// identifier, constant/literal, operator each get a distinct, consistent hue.
export const snowySqlHighlight = HighlightStyle.define([
  { tag: t.keyword, color: SYNTAX.keyword }, // purple — SELECT, FROM, WHERE …
  { tag: t.name, color: SYNTAX.identifier }, // grey — table / column names
  { tag: t.variableName, color: SYNTAX.identifier },
  { tag: t.propertyName, color: SYNTAX.identifier },
  { tag: t.special(t.name), color: SYNTAX.function, fontStyle: 'italic' }, // function calls
  { tag: t.string, color: SYNTAX.string }, // green — string literals
  { tag: t.number, color: SYNTAX.constant }, // blue — numbers
  { tag: t.bool, color: SYNTAX.constant }, // blue — TRUE / FALSE
  { tag: t.null, color: SYNTAX.constant }, // blue — NULL
  { tag: t.operator, color: SYNTAX.operator },
  { tag: t.punctuation, color: SYNTAX.operator },
  { tag: t.comment, color: SYNTAX.comment, fontStyle: 'italic' },
  { tag: t.typeName, color: SYNTAX.type }, // teal — INT, VARCHAR …
]);

// ── Function-call highlighting ────────────────────────────────────────────────
// Lexical rule: a name touching '(' (no space) is a function call — covers both
// builtins (count, sum …) and user-defined functions (add_days …). Builtins like
// COUNT tokenize as Keyword, so a decoration is needed to re-colour them.
const functionMark = Decoration.mark({ class: 'cm-sql-function' });

// Node kinds that denote a callable name when immediately followed by '('.
const FN_NAME_NODES = new Set(['Identifier', 'QuotedIdentifier', 'Keyword']);

export function buildFunctionDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const tree = syntaxTree(state);
  const marks: Array<{ from: number; to: number }> = [];
  for (const { from, to } of ranges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (node.name !== 'Parens') return;
        const prev = node.node.prevSibling;
        // Adjacent (prev.to === '('.from) excludes clause keywords like `in (…)`.
        if (prev && prev.to === node.from && FN_NAME_NODES.has(prev.name)) {
          marks.push({ from: prev.from, to: prev.to });
        }
      },
    });
  }
  marks.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const m of marks) builder.add(m.from, m.to, functionMark);
  return builder.finish();
}

// The visible editor pane, as the area available for laying out tooltips.
export function editorPaneRect(view: {
  scrollDOM: Pick<HTMLElement, 'getBoundingClientRect'>;
}): Rect {
  const r = view.scrollDOM.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}

// Completion popups are laid out inside the editor pane rather than the whole
// window, so CodeMirror flips them above the cursor (or trims their height)
// near the bottom instead of spilling across the results separator.
export const editorTooltipSpace = tooltips({ tooltipSpace: editorPaneRect });

// CodeMirror theme driven entirely by the shared design tokens. Every colour is a
// `var(--t-*)` reference, so the editor follows SnowyDark / SnowyLight with the
// rest of the app (CSS variables resolve at paint time; no reconfigure needed).
const MONO = '"Monaco", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';

export const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', background: T.panel, color: T.text },
  '.cm-content': {
    fontFamily: MONO,
    caretColor: T.text,
    padding: '8px 0',
  },
  '.cm-scroller': { overflow: 'auto' },
  // Function calls; the mark nests inside the tag span (Prec.highest) so this wins.
  '.cm-sql-function': { color: SYNTAX.function, fontStyle: 'italic' },
  '.cm-gutters': {
    background: T.panel,
    borderRight: `1px solid ${T.border}`,
    color: T.textDim,
  },
  '.cm-activeLineGutter': { background: T.panelAlt, color: T.textSec },
  '.cm-activeLine': { background: T.panelAlt },
  // Native text selection is used (no drawSelection layer), so paint ::selection.
  '.cm-selectionBackground, ::selection': { background: `${T.selected} !important` },
  '.cm-focused .cm-selectionBackground': { background: T.selected },
  '.cm-cursor': { borderLeftColor: T.text },
  // The search extension mounts an empty no-op panel (FindBar replaces it); its default
  // light styling leaks a bright 1px line, so don't render the panel container at all.
  '.cm-panels': { display: 'none' },
  // Find matches (FindBar drives the search; the default panel is suppressed).
  '.cm-searchMatch': {
    background: `color-mix(in srgb, ${T.warn} 22%, transparent)`,
    outline: `1px solid color-mix(in srgb, ${T.warn} 45%, transparent)`,
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: `color-mix(in srgb, ${T.warn} 45%, transparent)`,
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    width: '440px',
    background: T.panelAlt,
    border: `1px solid ${T.border}`,
    borderRadius: '6px',
    boxShadow: T.shadow,
    overflow: 'hidden',
    fontFamily: MONO,
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul': { maxHeight: '240px', fontFamily: 'inherit' },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '5px 10px',
    color: T.text,
    display: 'flex',
    alignItems: 'center',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: T.selected,
    color: T.text,
  },
  '.cm-completionLabel': { color: T.text, flex: '1' },
  '.cm-completionDetail': {
    color: T.textDim,
    fontSize: '11px',
    marginLeft: '8px',
    fontStyle: 'normal',
  },
  '.cm-completionIcon': {
    width: '18px',
    marginRight: '4px',
    textAlign: 'center',
    fontSize: '10px',
    color: T.textDim,
    opacity: '1',
  },
  '.cm-completionIcon-type': { color: T.accent },
  '.cm-completionIcon-property': { color: T.warnText },
  '.cm-completionIcon-namespace': { color: SYNTAX.string },
  '.cm-completionIcon-keyword': { color: SYNTAX.keyword },
  '.cm-key-badge': {
    display: 'inline-block',
    fontSize: '9px',
    fontWeight: '700',
    letterSpacing: '0.02em',
    padding: '1px 4px',
    borderRadius: '3px',
    marginRight: '6px',
    lineHeight: '1.4',
    verticalAlign: 'middle',
  },
  '.cm-key-badge-pk': {
    background: `color-mix(in srgb, ${T.warn} 16%, transparent)`,
    color: T.warnText,
    border: `1px solid color-mix(in srgb, ${T.warn} 35%, transparent)`,
  },
  '.cm-key-badge-fk': {
    background: T.accentSoft,
    color: T.accent,
    border: `1px solid color-mix(in srgb, ${T.accent} 35%, transparent)`,
  },
  '.cm-key-badge-col': {
    background: T.hover,
    color: T.textDim,
    border: `1px solid ${T.border}`,
  },
  '.cm-completionMatchedText': {
    color: T.warnText,
    fontWeight: '600',
    textDecoration: 'none',
  },
});
