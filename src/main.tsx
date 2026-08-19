import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Base layer first: tokens, reset and the glass utility all sit below the
// component styles that override them.
import './styles/global.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
