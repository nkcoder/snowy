// Monoline icons tuned for 16-18px use. Thin strokes (1.5), minimal fill.
const Ico = {};

const mk = (paths, vb = 16) => ({ size = 16, color = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {paths}
  </svg>
);

Ico.Chevron = mk(<path d="M6 4l4 4-4 4"/>);
Ico.ChevronDown = mk(<path d="M4 6l4 4 4-4"/>);
Ico.ChevronRight = mk(<path d="M6 4l4 4-4 4"/>);
Ico.Search = mk(<><circle cx="7" cy="7" r="4"/><path d="M13 13l-3-3"/></>);
Ico.Plus = mk(<><path d="M8 3v10M3 8h10"/></>);
Ico.Play = mk(<path d="M5 3l8 5-8 5V3z" fill="currentColor" stroke="none"/>);
Ico.Pause = mk(<><rect x="4" y="3" width="3" height="10" fill="currentColor" stroke="none"/><rect x="9" y="3" width="3" height="10" fill="currentColor" stroke="none"/></>);
Ico.Stop = mk(<rect x="4" y="4" width="8" height="8" fill="currentColor" stroke="none"/>);
Ico.Dot = mk(<circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/>);
Ico.Folder = mk(<path d="M2 4.5a1 1 0 011-1h3.5l1 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z"/>);
Ico.Database = mk(<><ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4"/><path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8"/></>);
Ico.Table = mk(<><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6.5h12M2 10h12M6 3v10M10 3v10"/></>);
Ico.Schema = mk(<><rect x="2" y="3" width="5" height="4" rx="1"/><rect x="9" y="9" width="5" height="4" rx="1"/><path d="M4.5 7v2.5a1 1 0 001 1H9"/></>);
Ico.View = mk(<><circle cx="8" cy="8" r="2.2"/><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/></>);
Ico.Column = mk(<><rect x="6" y="2" width="4" height="12" rx="1"/></>);
Ico.Key = mk(<><circle cx="5" cy="11" r="2.5"/><path d="M7 9l5-5M10 4l2 2M9 5l1.5 1.5"/></>);
Ico.Function = mk(<path d="M10 2s-1.5 0-2 1.5S7 9 6.5 11 5 13 4 13M4.5 7.5h5"/>);
Ico.History = mk(<><path d="M3 8a5 5 0 105-5 5 5 0 00-4 2"/><path d="M3 2v3h3"/><path d="M8 5v3l2 1.5"/></>);
Ico.Save = mk(<><path d="M3 3h8l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M5 3v3h5V3M5 10h6"/></>);
Ico.Settings = mk(<><circle cx="8" cy="8" r="2"/><path d="M8 2v1.5M8 12.5V14M3.5 8H2M14 8h-1.5M4.5 4.5L3.8 3.8M12.2 12.2l-.7-.7M4.5 11.5l-.7.7M12.2 3.8l-.7.7"/></>);
Ico.Sparkle = mk(<><path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z"/></>);
Ico.Pin = mk(<><path d="M6 2h4l-1 4 3 2-4 1 .5 4L8 12l-1.5-1.5L7 7 3 6l3-2-0-2z"/></>);
Ico.Filter = mk(<path d="M2 3h12l-4.5 5.5V13l-3-1V8.5L2 3z"/>);
Ico.Sort = mk(<><path d="M5 3v10M2 6l3-3 3 3"/><path d="M11 13V3M8 10l3 3 3-3"/></>);
Ico.Lightning = mk(<path d="M8 1L3 9h4l-1 6 5-8H7l1-6z" fill="currentColor" fillOpacity=".15"/>);
Ico.Refresh = mk(<><path d="M2 8a6 6 0 0110-4.5L13 5"/><path d="M13 2v3h-3"/><path d="M14 8a6 6 0 01-10 4.5L3 11"/><path d="M3 14v-3h3"/></>);
Ico.Check = mk(<path d="M3 8.5l3 3 7-7"/>);
Ico.X = mk(<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>);
Ico.Lock = mk(<><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 016 0v2"/></>);
Ico.Wifi = mk(<><path d="M2 6a9 9 0 0112 0M4 8.5a6 6 0 018 0M6 11a3 3 0 014 0"/><circle cx="8" cy="13" r=".8" fill="currentColor"/></>);
Ico.Grid = mk(<><rect x="2" y="2" width="5" height="5" rx=".5"/><rect x="9" y="2" width="5" height="5" rx=".5"/><rect x="2" y="9" width="5" height="5" rx=".5"/><rect x="9" y="9" width="5" height="5" rx=".5"/></>);
Ico.Editor = mk(<><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M4.5 5h7M4.5 7.5h5M4.5 10h6"/></>);
Ico.Dash = mk(<><rect x="2" y="2" width="5" height="6" rx="1"/><rect x="9" y="2" width="5" height="4" rx="1"/><rect x="2" y="10" width="5" height="4" rx="1"/><rect x="9" y="8" width="5" height="6" rx="1"/></>);
Ico.Cmd = mk(<><circle cx="4.5" cy="4.5" r="1.5"/><circle cx="11.5" cy="4.5" r="1.5"/><circle cx="4.5" cy="11.5" r="1.5"/><circle cx="11.5" cy="11.5" r="1.5"/><path d="M6 4.5h4M6 11.5h4M4.5 6v4M11.5 6v4"/></>);
Ico.Arrow = mk(<path d="M3 8h10M9 4l4 4-4 4"/>);
Ico.Split = mk(<><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M8 3v10"/></>);
Ico.Tree = mk(<><path d="M3 4h3M3 8h3M3 12h3"/><circle cx="2" cy="4" r=".8" fill="currentColor"/><circle cx="2" cy="8" r=".8" fill="currentColor"/><circle cx="2" cy="12" r=".8" fill="currentColor"/></>);
Ico.Circle = mk(<circle cx="8" cy="8" r="5"/>);
Ico.Dots = mk(<><circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none"/></>);
Ico.Clock = mk(<><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/></>);
Ico.Star = mk(<path d="M8 2l1.8 4 4.2.5-3.2 2.8 1 4.2L8 11.5 4.2 13.5l1-4.2L2 6.5l4.2-.5L8 2z"/>);
Ico.Enter = mk(<><path d="M13 3v5a2 2 0 01-2 2H3"/><path d="M6 7L3 10l3 3"/></>);
Ico.Sidebar = mk(<><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M6 3v10"/></>);

Object.assign(window, { Ico });
