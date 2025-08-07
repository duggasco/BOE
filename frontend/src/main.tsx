import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './index.css'
import './styles/theme.css'
import './styles/responsive.css'
import './styles/accessibility.css'
import App from './App.tsx'

console.log('Main.tsx loaded');

const root = document.getElementById('root');
if (!root) {
  console.error('Root element not found!');
} else {
  console.log('Root element found, mounting React...');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
