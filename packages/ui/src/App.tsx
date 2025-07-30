import { useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { DocsPage } from '@/pages/DocsPage'
import { HowItWorksModal } from '@/components/HowItWorksModal'
import './App.css'

export function App() {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const location = useLocation()
  
  const isDocsPage = location.pathname.startsWith('/docs')

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            prompt dial
          </Link>
          <div className="nav-items">
            <button 
              className="nav-link"
              onClick={() => setShowHowItWorks(true)}
              type="button"
            >
              How it Works
            </button>
            <Link to="/docs/getting-started/quick-start" className={`nav-link ${isDocsPage ? 'nav-link-active' : ''}`}>
              Docs
            </Link>
            <button className="nav-sign-in">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                width="16"
                height="16"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/:category/:section" element={<DocsPage />} />
        <Route path="/docs/:category" element={<Navigate to="/docs/getting-started/quick-start" replace />} />
        <Route path="/docs" element={<Navigate to="/docs/getting-started/quick-start" replace />} />
      </Routes>
      
      {/* How It Works Modal */}
      <HowItWorksModal 
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
    </div>
  )
}

export default App
