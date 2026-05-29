import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { Launcher } from './routes/Launcher.tsx'
import { GMScreen } from './routes/GMScreen.tsx'
import { PlayerScreen } from './routes/PlayerScreen.tsx'

// HashRouter: GitHub Pages serves static files, so deep links / refreshes on
// path routes would 404. Routing lives in the URL hash instead (#/gm, #/room).
const router = createHashRouter([
  { path: '/', element: <Launcher /> },
  { path: '/gm', element: <GMScreen /> },
  { path: '/room', element: <PlayerScreen /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
