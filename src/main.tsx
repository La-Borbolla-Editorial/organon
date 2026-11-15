import { createRoot } from 'react-dom/client'
import 'pdfjs-dist/web/pdf_viewer.css'
import './styles.css'
import { App } from './App'
import { initAppearance } from './appearance'

// El tema se aplica antes de pintar para no ver un destello con los colores por defecto
// (con un límite: si tarda, se pinta igual).
void Promise.race([initAppearance().catch(() => {}), new Promise((r) => setTimeout(r, 400))]).then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
