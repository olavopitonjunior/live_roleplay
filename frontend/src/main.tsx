import { StrictMode, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Disable StrictMode in E2E tests — StrictMode's double-mount causes
// LiveKitRoom to disconnect the existing room during cleanup cycle
const isE2E = localStorage.getItem('e2e_mode') === 'true'
const Wrapper = isE2E ? Fragment : StrictMode

createRoot(document.getElementById('root')!).render(
  <Wrapper>
    <App />
  </Wrapper>,
)
