import {createRoot} from 'react-dom/client'
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './style.css'
import App from './App'

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(<App />)
