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
  const [activeTab, setActiveTab] = useState('view')
  const [formData, setFormData] = useState({
    segment_name: '',
    distance: '',
    elevation_gain: '',
    elevation_loss: '',
    crown_holder: '',
    crown_date: '',
    crown_time: '',
    crown_pace: '',
    personal_best_time: '',
    personal_best_pace: '',
    personal_attempts: 0,
    overall_attempts: 0,
    difficulty: '',
    last_attempt_date: '',
    strava_url: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

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

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'personal_attempts' || name === 'overall_attempts' ? parseInt(value) || 0 : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Prepare data - convert empty strings to null for optional fields
      const submitData = {
        segment_name: formData.segment_name,
        distance: formData.distance ? parseFloat(formData.distance) : null,
        elevation_gain: formData.elevation_gain ? parseFloat(formData.elevation_gain) : null,
        elevation_loss: formData.elevation_loss ? parseFloat(formData.elevation_loss) : null,
        crown_holder: formData.crown_holder || null,
        crown_date: formData.crown_date || null,
        crown_time: formData.crown_time || null,
        crown_pace: formData.crown_pace || null,
        personal_best_time: formData.personal_best_time || null,
        personal_best_pace: formData.personal_best_pace || null,
        personal_attempts: formData.personal_attempts || 0,
        overall_attempts: formData.overall_attempts || 0,
        difficulty: formData.difficulty ? parseInt(formData.difficulty) : null,
        last_attempt_date: formData.last_attempt_date || null,
        strava_url: formData.strava_url || null
      }

      const response = await fetch(`${apiUrl}/items/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      const newItem = await response.json()
      setItems([...items, newItem])
      setSubmitSuccess(true)
      
      // Reset form
      setFormData({
        segment_name: '',
        distance: '',
        elevation_gain: '',
        elevation_loss: '',
        crown_holder: '',
        crown_date: '',
        crown_time: '',
        crown_pace: '',
        personal_best_time: '',
        personal_best_pace: '',
        personal_attempts: 0,
        overall_attempts: 0,
        difficulty: '',
        last_attempt_date: '',
        strava_url: ''
      })

      // Switch to view tab after 2 seconds
      setTimeout(() => {
        setActiveTab('view')
        setSubmitSuccess(false)
      }, 2000)
    } catch (err) {
      setSubmitError(err.message)
      console.error('Error creating segment:', err)
    } finally {
      setSubmitting(false)
    }
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
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            View Segments
          </button>
          <button
            className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Add Segment
          </button>
        </div>
        
        {activeTab === 'add' && (
          <div className="add-segment-container">
            <h2>Add New Segment</h2>
            {submitSuccess && (
              <div className="success-message">
                Segment added successfully! Switching to view...
              </div>
            )}
            {submitError && (
              <div className="error-message">
                Error: {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="segment-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="segment_name">Segment Name *</label>
                  <input
                    type="text"
                    id="segment_name"
                    name="segment_name"
                    value={formData.segment_name}
                    onChange={handleFormChange}
                    required
                    placeholder="e.g., Here lies Dobby a free elf"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="strava_url">Strava URL</label>
                  <input
                    type="url"
                    id="strava_url"
                    name="strava_url"
                    value={formData.strava_url}
                    onChange={handleFormChange}
                    placeholder="https://www.strava.com/segments/12345"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="distance">Distance (miles)</label>
                  <input
                    type="number"
                    id="distance"
                    name="distance"
                    value={formData.distance}
                    onChange={handleFormChange}
                    step="0.01"
                    placeholder="2.68"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="elevation_gain">Elevation Gain (ft)</label>
                  <input
                    type="number"
                    id="elevation_gain"
                    name="elevation_gain"
                    value={formData.elevation_gain}
                    onChange={handleFormChange}
                    step="0.1"
                    placeholder="275"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="elevation_loss">Elevation Loss (ft)</label>
                  <input
                    type="number"
                    id="elevation_loss"
                    name="elevation_loss"
                    value={formData.elevation_loss}
                    onChange={handleFormChange}
                    step="0.1"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Crown Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="crown_holder">Crown Holder</label>
                    <input
                      type="text"
                      id="crown_holder"
                      name="crown_holder"
                      value={formData.crown_holder}
                      onChange={handleFormChange}
                      placeholder="Jacob Smith"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="crown_date">Crown Date</label>
                    <input
                      type="text"
                      id="crown_date"
                      name="crown_date"
                      value={formData.crown_date}
                      onChange={handleFormChange}
                      placeholder="12-Aug-25"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="crown_time">Crown Time (MM:SS)</label>
                    <input
                      type="text"
                      id="crown_time"
                      name="crown_time"
                      value={formData.crown_time}
                      onChange={handleFormChange}
                      placeholder="22:55"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="crown_pace">Crown Pace (MM:SS)</label>
                    <input
                      type="text"
                      id="crown_pace"
                      name="crown_pace"
                      value={formData.crown_pace}
                      onChange={handleFormChange}
                      placeholder="8:35"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Personal Best</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="personal_best_time">Personal Best Time</label>
                    <input
                      type="text"
                      id="personal_best_time"
                      name="personal_best_time"
                      value={formData.personal_best_time}
                      onChange={handleFormChange}
                      placeholder="32:59:00"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_best_pace">Personal Best Pace</label>
                    <input
                      type="text"
                      id="personal_best_pace"
                      name="personal_best_pace"
                      value={formData.personal_best_pace}
                      onChange={handleFormChange}
                      placeholder="12:17"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_attempts">Personal Attempts</label>
                    <input
                      type="number"
                      id="personal_attempts"
                      name="personal_attempts"
                      value={formData.personal_attempts}
                      onChange={handleFormChange}
                      min="0"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="overall_attempts">Overall Attempts</label>
                  <input
                    type="number"
                    id="overall_attempts"
                    name="overall_attempts"
                    value={formData.overall_attempts}
                    onChange={handleFormChange}
                    min="0"
                    placeholder="6"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="difficulty">Difficulty (1-10)</label>
                  <input
                    type="number"
                    id="difficulty"
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleFormChange}
                    min="1"
                    max="10"
                    placeholder="7"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="last_attempt_date">Last Attempt Date</label>
                  <input
                    type="text"
                    id="last_attempt_date"
                    name="last_attempt_date"
                    value={formData.last_attempt_date}
                    onChange={handleFormChange}
                    placeholder="7/3/2025"
                  />
                </div>
              </div>

              <button type="submit" className="submit-button" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Segment'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'view' && (
          <>
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
          </>
        )}
      </main>
    </div>
  )
}

export default App

