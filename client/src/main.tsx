import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { RootProviders } from './app/providers/RootProviders'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Unable to find root element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </StrictMode>,
)
