import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// DataGrip-inspired syntax colors — overrides oneDark via Prec.high.
export const snowySqlHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#56B6C2' }, // teal — SELECT, FROM, WHERE …
  { tag: t.name, color: '#D19A66' }, // orange — table / column names
  { tag: t.variableName, color: '#D19A66' },
  { tag: t.propertyName, color: '#D19A66' },
  { tag: t.special(t.name), color: '#E5C07B' }, // gold — function calls
  { tag: t.string, color: '#98C379' }, // green — string literals
  { tag: t.number, color: '#B5CEA8' }, // light green — numbers
  { tag: t.operator, color: '#ABB2BF' },
  { tag: t.punctuation, color: '#ABB2BF' },
  { tag: t.comment, color: '#6A9955', fontStyle: 'italic' },
  { tag: t.typeName, color: '#56B6C2' }, // teal — INT, VARCHAR …
]);

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
