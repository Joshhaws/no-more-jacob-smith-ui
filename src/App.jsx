import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [dibs, setDibs] = useState(() => {
    // Load dibs from localStorage on initial load
    const savedDibs = localStorage.getItem('segmentDibs')
    return savedDibs ? JSON.parse(savedDibs) : {}
  })
  const [tempDibs, setTempDibs] = useState({})

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/items/`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setItems(data)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value) => {
    if (value === null || value === undefined || value === 'NaN' || value === '') {
      return '—'
    }
    return value
  }

  const formatDistance = (value) => {
    if (!value || value === 'NaN') return '—'
    return `${value} mi`
  }

  const formatElevation = (value) => {
    if (!value || value === 'NaN') return '—'
    return `${value} ft`
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(items.length / itemsPerPage)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value))
    setCurrentPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDibsChange = (itemId, value) => {
    const newDibs = { ...dibs, [itemId]: value }
    setDibs(newDibs)
    localStorage.setItem('segmentDibs', JSON.stringify(newDibs))
  }

  const handleDibsSave = (itemId) => {
    const trimmedValue = (tempDibs[itemId] || '').trim()
    if (trimmedValue) {
      handleDibsChange(itemId, trimmedValue)
      // Clear temp value after saving
      const newTempDibs = { ...tempDibs }
      delete newTempDibs[itemId]
      setTempDibs(newTempDibs)
    }
  }

  const handleDibsClear = (itemId) => {
    const newDibs = { ...dibs }
    delete newDibs[itemId]
    setDibs(newDibs)
    localStorage.setItem('segmentDibs', JSON.stringify(newDibs))
    // Also clear temp value
    const newTempDibs = { ...tempDibs }
    delete newTempDibs[itemId]
    setTempDibs(newTempDibs)
  }

  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i)
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i)
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i)
        }
      }
    }
    return pageNumbers
  }

  // Reset to page 1 when items change
  useEffect(() => {
    setCurrentPage(1)
  }, [items.length])

  // Reset to page 1 when itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  return (
    <div className="app">
      <header className="header">
        <h1>Strava Segment Tracker</h1>
      </header>
      <main className="main-content">
        {loading && <div className="loading">Loading segments...</div>}
        {error && (
          <div className="error">
            Error loading segments: {error}
            <button onClick={fetchItems} className="retry-button">Retry</button>
          </div>
        )}
        {!loading && !error && (
          <div className="table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Dibs</th>
                  <th>Segment Name</th>
                  <th>Distance</th>
                  <th>Elevation Gain</th>
                  <th>Elevation Loss</th>
                  <th>Crown Holder</th>
                  <th>Crown Date</th>
                  <th>Crown Time</th>
                  <th>Crown Pace</th>
                  <th>Personal Best Time</th>
                  <th>Personal Best Pace</th>
                  <th>Personal Attempts</th>
                  <th>Overall Attempts</th>
                  <th>Difficulty</th>
                  <th>Last Attempt Date</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="15" style={{ textAlign: 'center', padding: '2rem' }}>
                      No segments found. Create some segments using the API!
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Dibs" className="dibs-cell">
                        <div className="dibs-input-wrapper">
                          {dibs[item.id] ? (
                            <div className="dibs-display">
                              <span className="dibs-name">{dibs[item.id]}</span>
                              <button
                                className="dibs-clear-button"
                                onClick={() => handleDibsClear(item.id)}
                                aria-label="Clear dibs"
                                title="Clear dibs"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                className="dibs-input"
                                placeholder="Your name..."
                                value={tempDibs[item.id] !== undefined ? tempDibs[item.id] : (dibs[item.id] || '')}
                                onChange={(e) => {
                                  setTempDibs({ ...tempDibs, [item.id]: e.target.value })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleDibsSave(item.id)
                                  }
                                }}
                                aria-label="Claim this segment"
                              />
                              <button
                                className="dibs-save-button"
                                onClick={() => handleDibsSave(item.id)}
                                aria-label="Save dibs"
                                title="Save"
                              >
                                ✓
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="activity-name" data-label="">
                        {item.strava_url ? (
                          <a 
                            href={item.strava_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="segment-name-link"
                          >
                            {formatValue(item.segment_name)}
                          </a>
                        ) : (
                          formatValue(item.segment_name)
                        )}
                      </td>
                      <td data-label="Distance">{formatDistance(item.distance)}</td>
                      <td data-label="Elevation Gain">{formatElevation(item.elevation_gain)}</td>
                      <td data-label="Elevation Loss">{formatElevation(item.elevation_loss)}</td>
                      <td data-label="Crown Holder">{formatValue(item.crown_holder)}</td>
                      <td data-label="Crown Date">{formatValue(item.crown_date)}</td>
                      <td data-label="Crown Time">{formatValue(item.crown_time)}</td>
                      <td data-label="Crown Pace">{formatValue(item.crown_pace)}</td>
                      <td data-label="Personal Best Time">{formatValue(item.personal_best_time)}</td>
                      <td data-label="Personal Best Pace">{formatValue(item.personal_best_pace)}</td>
                      <td data-label="Personal Attempts">{formatValue(item.personal_attempts)}</td>
                      <td data-label="Overall Attempts">{formatValue(item.overall_attempts)}</td>
                      <td data-label="Difficulty">{formatValue(item.difficulty)}</td>
                      <td data-label="Last Attempt Date">{formatValue(item.last_attempt_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-left">
              <div className="pagination-info">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, items.length)} of {items.length} segments
              </div>
              <div className="items-per-page">
                <label htmlFor="items-per-page-select" className="items-per-page-label">
                  Show:
                </label>
                <select
                  id="items-per-page-select"
                  className="items-per-page-select"
                  value={itemsPerPage}
                  onChange={handleItemsPerPageChange}
                  aria-label="Items per page"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="pagination">
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  className={`pagination-button ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => handlePageChange(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

