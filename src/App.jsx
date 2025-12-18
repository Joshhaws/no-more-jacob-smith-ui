import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
                  <th>Strava</th>
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
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="activity-name">{formatValue(item.segment_name)}</td>
                      <td>{formatDistance(item.distance)}</td>
                      <td>{formatElevation(item.elevation_gain)}</td>
                      <td>{formatElevation(item.elevation_loss)}</td>
                      <td>{formatValue(item.crown_holder)}</td>
                      <td>{formatValue(item.crown_date)}</td>
                      <td>{formatValue(item.crown_time)}</td>
                      <td>{formatValue(item.crown_pace)}</td>
                      <td>{formatValue(item.personal_best_time)}</td>
                      <td>{formatValue(item.personal_best_pace)}</td>
                      <td>{formatValue(item.personal_attempts)}</td>
                      <td>{formatValue(item.overall_attempts)}</td>
                      <td>{formatValue(item.difficulty)}</td>
                      <td>{formatValue(item.last_attempt_date)}</td>
                      <td>
                        {item.strava_url ? (
                          <a 
                            href={item.strava_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="strava-link"
                          >
                            View Segment
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

