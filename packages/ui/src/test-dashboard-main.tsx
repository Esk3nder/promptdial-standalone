import React from 'react'
import ReactDOM from 'react-dom/client'
import TestDashboardApp from './TestDashboardApp.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestDashboardApp />
  </React.StrictMode>,
)
