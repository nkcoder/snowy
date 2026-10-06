import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './style.css';
import App from './App';
import { applyTheme, readStoredMode, systemPrefersDark } from './lib/theme';

// Apply the saved appearance before first paint so a light-mode user never sees a dark flash.
applyTheme(readStoredMode(), systemPrefersDark());

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);

root.render(<App />);
