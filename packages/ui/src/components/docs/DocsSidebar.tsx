import { Link } from 'react-router-dom'
import styles from './DocsSidebar.module.css'

interface DocsSidebarProps {
  structure: Record<string, {
    title: string
    icon: string
    sections: Record<string, string>
  }>
  currentCategory: string
  currentSection: string
  isOpen: boolean
  onClose: () => void
}

export function DocsSidebar({ 
  structure, 
  currentCategory, 
  currentSection, 
  isOpen, 
  onClose 
}: DocsSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className={styles.overlay} 
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarContent}>
          {/* Mobile close button */}
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Navigation */}
          <nav className={styles.nav}>
            {Object.entries(structure).map(([categoryKey, category]) => (
              <div key={categoryKey} className={styles.category}>
                <h3 className={styles.categoryTitle}>
                  <span className={styles.categoryIcon}>{category.icon}</span>
                  {category.title}
                </h3>
                
                <ul className={styles.sectionList}>
                  {Object.entries(category.sections).map(([sectionKey, sectionTitle]) => {
                    const isActive = categoryKey === currentCategory && sectionKey === currentSection
                    
                    return (
                      <li key={sectionKey}>
                        <Link
                          to={`/docs/${categoryKey}/${sectionKey}`}
                          className={`${styles.sectionLink} ${isActive ? styles.sectionLinkActive : ''}`}
                          onClick={onClose}
                        >
                          {sectionTitle}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}