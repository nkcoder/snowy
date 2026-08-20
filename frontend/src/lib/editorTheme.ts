import { HighlightStyle, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, type Rect, tooltips } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { SYNTAX } from './tokens';

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

// Static CodeMirror theme matched to SnowyDark tokens.
// Theme-switching via CSS vars inside CodeMirror is unsupported — editor stays dark.
export const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', background: '#1f1d1b' },
    '.cm-content': {
      fontFamily: '"Monaco", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
      caretColor: '#ecebe8',
      padding: '8px 0',
    },
    '.cm-scroller': { overflow: 'auto' },
    // Function calls; the mark nests inside the tag span (Prec.highest) so this wins.
    '.cm-sql-function': { color: SYNTAX.function, fontStyle: 'italic' },
    '.cm-gutters': {
      background: '#1f1d1b',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      color: '#6e6a62',
    },
    '.cm-activeLineGutter': { background: '#252320' },
    '.cm-activeLine': { background: '#252320' },
    '.cm-selectionBackground, ::selection': { background: 'oklch(0.28 0.07 240) !important' },
    '.cm-cursor': { borderLeftColor: '#ecebe8' },
    '.cm-focused .cm-selectionBackground': { background: 'oklch(0.28 0.07 240)' },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      width: '440px',
      background: '#232120',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      fontFamily: '"Monaco", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
      fontSize: '12px',
    },
    '.cm-tooltip-autocomplete > ul': { maxHeight: '240px', fontFamily: 'inherit' },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '5px 10px',
      color: '#ecebe8',
      borderLeft: '2px solid transparent',
      display: 'flex',
      alignItems: 'center',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      background: 'rgba(53, 116, 240, 0.15)',
      borderLeft: '2px solid oklch(0.62 0.17 240)',
    },
    '.cm-completionLabel': { color: '#ecebe8', flex: '1' },
    '.cm-completionDetail': {
      color: '#6e6a62',
      fontSize: '11px',
      marginLeft: '8px',
      fontStyle: 'normal',
    },
    '.cm-completionIcon': {
      width: '18px',
      marginRight: '4px',
      textAlign: 'center',
      fontSize: '10px',
      color: '#6e6a62',
      opacity: '1',
    },
    '.cm-completionIcon-type': { color: 'oklch(0.62 0.17 240)' },
    '.cm-completionIcon-property': { color: '#e5c07b' },
    '.cm-completionIcon-namespace': { color: '#98c379' },
    '.cm-completionIcon-keyword': { color: '#c678dd' },
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
      background: 'rgba(229,192,123,0.15)',
      color: '#e5c07b',
      border: '1px solid rgba(229,192,123,0.3)',
    },
    '.cm-key-badge-fk': {
      background: 'rgba(53,116,240,0.15)',
      color: 'oklch(0.72 0.17 240)',
      border: '1px solid rgba(53,116,240,0.3)',
    },
    '.cm-key-badge-col': {
      background: 'rgba(255,255,255,0.05)',
      color: '#6e6a62',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    '.cm-completionMatchedText': {
      color: '#e5c07b',
      fontWeight: '600',
      textDecoration: 'none',
    },
  },
  { dark: true }
);
