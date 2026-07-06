import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/quicksand/index.css'
import '@fontsource-variable/hanken-grotesk/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './index.css'
import Preview from './Preview.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
