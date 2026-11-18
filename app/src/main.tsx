import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PdfViewer, PDF_VIEWER_HASH } from './components/PdfViewer.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.hash.startsWith(PDF_VIEWER_HASH) ? <PdfViewer /> : <App />}
  </StrictMode>,
)
