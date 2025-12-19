import { useState, useEffect } from 'react'
import './App.css'
import SegmentMap from './SegmentMap'

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [dibs, setDibs] = useState({})
  const [tempDibs, setTempDibs] = useState({})
  const [savingDibs, setSavingDibs] = useState({}) // Track which dibs are being saved
  const [completingItems, setCompletingItems] = useState({}) // Track which items are being marked as complete
  const [activeTab, setActiveTab] = useState('view')
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  const [formData, setFormData] = useState({
    segment_name: '',
    distance: '',
    elevation_gain: '',
    elevation_loss: '',
    crown_holder: '',
    crown_date: '',
    crown_time: '',
    crown_pace: '',
    overall_attempts: 0,
    strava_url: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [fetchingSegment, setFetchingSegment] = useState(false)
  const [segmentPreview, setSegmentPreview] = useState(null) // Store fetched segment preview data
  const [stravaConnected, setStravaConnected] = useState(false)
  const [syncingSegmentId, setSyncingSegmentId] = useState(null)
  const [expandedRows, setExpandedRows] = useState(new Set()) // Track which rows are expanded
  const [loadingDetails, setLoadingDetails] = useState({}) // Track which segments are loading details
  const [segmentDetails, setSegmentDetails] = useState({}) // Store detailed segment data
  const [editingCrown, setEditingCrown] = useState(null) // Track which item's crown info is being edited (item.id)
  const [crownEditData, setCrownEditData] = useState({}) // Store edited crown values
  const [savingCrown, setSavingCrown] = useState(false) // Track if crown is being saved

  useEffect(() => {
    fetchItems()
    checkStravaStatus()
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('strava_connected') === 'true') {
      setStravaConnected(true)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
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
      // Initialize dibs from API data (for backward compatibility with local state)
      const dibsFromApi = {}
      data.forEach(item => {
        if (item.dibs) {
          dibsFromApi[item.id] = item.dibs
        }
      })
      setDibs(dibsFromApi)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  const [athleteName, setAthleteName] = useState(null)

  const checkStravaStatus = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/auth/strava/status`)
      if (response.ok) {
        const data = await response.json()
        setStravaConnected(data.connected)
        setAthleteName(data.athlete_name || null)
      }
    } catch (err) {
      console.error('Error checking Strava status:', err)
    }
  }

  const handleStravaConnect = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/auth/strava/authorize`)
      if (!response.ok) {
        throw new Error('Failed to get authorization URL')
      }
      const data = await response.json()
      // Redirect to Strava authorization page
      window.location.href = data.authorization_url
    } catch (err) {
      alert(`Failed to connect to Strava: ${err.message}`)
      console.error('Error connecting to Strava:', err)
    }
  }

  const handleStravaDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Strava account?')) {
      return
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/auth/strava/disconnect`, {
        method: 'POST'
      })
      if (response.ok) {
        setStravaConnected(false)
        alert('Strava account disconnected')
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (err) {
      alert(`Failed to disconnect Strava: ${err.message}`)
      console.error('Error disconnecting Strava:', err)
    }
  }

  const syncSegmentFromStrava = async (item) => {
    const segmentId = item.strava_segment_id || extractSegmentId(item.strava_url)
    if (!segmentId) {
      alert('No Strava segment ID found for this segment')
      return
    }

    setSyncingSegmentId(item.id)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/strava/segments/${segmentId}/times`)
      if (!response.ok) {
        if (response.status === 401) {
          setStravaConnected(false)
          alert('Strava connection expired. Please reconnect.')
          return
        }
        throw new Error(`Failed to fetch segment data: ${response.status}`)
      }
      const segmentData = await response.json()
      
      // Update the item with Strava data
      const updatedItem = {
        ...item,
        personal_best_time: segmentData.personal_best_time || item.personal_best_time,
        personal_best_pace: segmentData.personal_best_pace || item.personal_best_pace,
        personal_attempts: segmentData.personal_attempts ?? item.personal_attempts,
        last_attempt_date: segmentData.last_attempt_date || item.last_attempt_date
      }
      
      // Update via API
      const updateResponse = await fetch(`${apiUrl}/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personal_best_time: segmentData.personal_best_time,
          personal_best_pace: segmentData.personal_best_pace,
          personal_attempts: segmentData.personal_attempts,
          last_attempt_date: segmentData.last_attempt_date
        })
      })

      if (updateResponse.ok) {
        const updated = await updateResponse.json()
        setItems(items.map(i => i.id === item.id ? updated : i))
      }
    } catch (err) {
      alert(`Failed to sync segment: ${err.message}`)
      console.error('Error syncing segment:', err)
    } finally {
      setSyncingSegmentId(null)
    }
  }

  const extractSegmentId = (stravaUrl) => {
    if (!stravaUrl) return null
    const match = stravaUrl.match(/\/segments\/(\d+)/)
    return match ? parseInt(match[1]) : null
  }

  const fetchSegmentMetadata = async () => {
    const segmentId = extractSegmentId(formData.strava_url)
    if (!segmentId) {
      alert('Please enter a valid Strava segment URL (e.g., https://www.strava.com/segments/12345)')
      return
    }

    if (!stravaConnected) {
      const connect = window.confirm('You need to connect your Strava account to fetch segment details. Would you like to connect now?')
      if (connect) {
        handleStravaConnect()
      }
      return
    }

    setFetchingSegment(true)
    setSubmitError(null)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/strava/segments/${segmentId}/metadata`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          setStravaConnected(false)
          throw new Error('Strava connection expired. Please reconnect.')
        }
        throw new Error(errorData.detail || `Failed to fetch segment: ${response.status}`)
      }
      const metadata = await response.json()
      console.log('Fetched segment metadata:', metadata)
      console.log('Polyline data:', metadata.polyline ? 'Present' : 'Missing', metadata.polyline)
      console.log('Start coordinates:', metadata.start_latitude, metadata.start_longitude)
      
      // Store preview data for confirmation
      setSegmentPreview({
        segment_name: metadata.segment_name || 'Unnamed Segment',
        distance: metadata.distance || null,
        elevation_gain: metadata.elevation_gain || null,
        elevation_loss: null,
        crown_holder: metadata.crown_holder || null,
        crown_date: metadata.crown_date || null,
        crown_time: metadata.crown_time || null,
        crown_pace: metadata.crown_pace || null,
        overall_attempts: 0,
        strava_url: metadata.strava_url || formData.strava_url,
        strava_segment_id: metadata.segment_id || extractSegmentId(metadata.strava_url || formData.strava_url),
        polyline: metadata.polyline || null,
        start_latitude: metadata.start_latitude || null,
        start_longitude: metadata.start_longitude || null,
      })
    } catch (err) {
      setSubmitError(`Failed to fetch segment details: ${err.message}`)
      console.error('Error fetching segment metadata:', err)
    } finally {
      setFetchingSegment(false)
    }
  }

  const toggleRowExpansion = async (itemId, item) => {
    const isExpanded = expandedRows.has(itemId)
    const newExpandedRows = new Set(expandedRows)
    
    if (isExpanded) {
      // Collapse - clear cached data
      newExpandedRows.delete(itemId)
      setExpandedRows(newExpandedRows)
      // Clear the cached segment details for this item
      const newDetails = { ...segmentDetails }
      delete newDetails[itemId]
      setSegmentDetails(newDetails)
    } else {
      // Expand - always fetch fresh data from Strava
      newExpandedRows.add(itemId)
      setExpandedRows(newExpandedRows)
      
      const segmentId = item.strava_segment_id || extractSegmentId(item.strava_url)
      // Only fetch if we have a segment ID - connection status will be checked in fetchSegmentDetails
      if (segmentId) {
        // Always fetch fresh data, don't use cache
        await fetchSegmentDetails(itemId, segmentId)
      }
    }
  }

  const fetchSegmentDetails = async (itemId, segmentId) => {
    setLoadingDetails({ ...loadingDetails, [itemId]: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/strava/segments/${segmentId}/times`)
      if (!response.ok) {
        let errorMessage = `Failed to fetch segment data: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        
        if (response.status === 401) {
          // Only set stravaConnected to false if we get a 401
          setStravaConnected(false)
          throw new Error(errorMessage)
        }
        throw new Error(errorMessage)
      }
      const data = await response.json()
      // Success - ensure stravaConnected is true
      setStravaConnected(true)
      setSegmentDetails({ ...segmentDetails, [itemId]: data })
    } catch (err) {
      console.error('Error fetching segment details:', err)
      console.error('Error details:', { itemId, segmentId, error: err.message })
      // Don't show alert, just log - user can see error in UI
      setSegmentDetails({ ...segmentDetails, [itemId]: { error: err.message } })
    } finally {
      setLoadingDetails({ ...loadingDetails, [itemId]: false })
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

  const startEditingCrown = (item) => {
    setEditingCrown(item.id)
    setCrownEditData({
      crown_holder: item.crown_holder || '',
      crown_date: item.crown_date || '',
      crown_time: item.crown_time || '',
      crown_pace: item.crown_pace || '',
    })
  }

  const cancelEditingCrown = () => {
    setEditingCrown(null)
    setCrownEditData({})
  }

  const saveCrownInfo = async (itemId) => {
    setSavingCrown(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crown_holder: crownEditData.crown_holder || null,
          crown_date: crownEditData.crown_date || null,
          crown_time: crownEditData.crown_time || null,
          crown_pace: crownEditData.crown_pace || null,
        })
      })

      if (!response.ok) {
        let errorMessage = `Failed to update crown info: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorMessage
        } catch (e) {
          // Ignore
        }
        throw new Error(errorMessage)
      }

      const updatedItem = await response.json()
      // Update the item in the items list
      setItems(items.map(item => item.id === itemId ? updatedItem : item))
      setEditingCrown(null)
      setCrownEditData({})
    } catch (err) {
      alert(`Failed to save crown information: ${err.message}`)
      console.error('Error saving crown info:', err)
    } finally {
      setSavingCrown(false)
    }
  }

  // Sorting logic
  const getSortValue = (item, column) => {
    switch (column) {
      case 'dibs':
        return item.dibs || ''
      case 'segment_name':
        return item.segment_name || ''
      case 'strava_segment_id':
        return item.strava_segment_id || extractSegmentId(item.strava_url) || 0
      case 'distance':
        return item.distance ?? Infinity
      case 'elevation_gain':
        return item.elevation_gain ?? Infinity
      case 'elevation_loss':
        return item.elevation_loss ?? Infinity
      case 'crown_holder':
        return item.crown_holder || ''
      case 'crown_date':
        return item.crown_date || ''
      case 'crown_time':
        return item.crown_time || ''
      case 'crown_pace':
        return item.crown_pace || ''
      case 'personal_best_time':
        return item.personal_best_time || ''
      case 'personal_best_pace':
        return item.personal_best_pace || ''
      case 'personal_attempts':
        return item.personal_attempts ?? Infinity
      case 'overall_attempts':
        return item.overall_attempts ?? Infinity
      case 'last_attempt_date':
        return item.last_attempt_date || ''
      default:
        return ''
    }
  }

  // Filter items into active and completed
  const activeItems = items.filter(item => !item.completed)
  const completedItems = items.filter(item => item.completed)

  const sortedActiveItems = [...activeItems].sort((a, b) => {
    if (!sortColumn) return 0
    
    const aValue = getSortValue(a, sortColumn)
    const bValue = getSortValue(b, sortColumn)
    
    // Handle null/undefined values
    if (aValue === Infinity && bValue === Infinity) return 0
    if (aValue === Infinity) return 1
    if (bValue === Infinity) return -1
    
    // Compare values
    let comparison = 0
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue
    } else {
      comparison = String(aValue).localeCompare(String(bValue))
    }
    
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const sortedCompletedItems = [...completedItems].sort((a, b) => {
    // Sort completed items by name
    return a.segment_name.localeCompare(b.segment_name)
  })

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = sortedActiveItems.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedActiveItems.length / itemsPerPage)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value))
    setCurrentPage(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  const handleMarkComplete = async (itemId, segmentName) => {
    setCompletingItems({ ...completingItems, [itemId]: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/items/${itemId}/complete`, {
        method: 'PUT'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to mark segment as complete: ${response.status}`)
      }

      const result = await response.json()
      
      // Update the item's completed status
      setItems(items.map(item => 
        item.id === itemId ? { ...item, completed: result.completed } : item
      ))
    } catch (err) {
      console.error('Error marking segment as complete:', err)
      alert(`Failed to mark segment as complete: ${err.message}`)
    } finally {
      setCompletingItems({ ...completingItems, [itemId]: false })
    }
  }

  const handleDibsClick = async (itemId) => {
    if (!stravaConnected) {
      alert('Please connect your Strava account first to claim a segment.')
      return
    }

      setSavingDibs({ ...savingDibs, [itemId]: true })
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // First, get athlete name from Strava
      const athleteResponse = await fetch(`${apiUrl}/auth/strava/athlete`)
      if (!athleteResponse.ok) {
        if (athleteResponse.status === 401) {
          setStravaConnected(false)
          setAthleteName(null)
          throw new Error('Strava authentication expired. Please reconnect.')
        }
        throw new Error('Failed to get athlete information')
      }
      
      const athleteData = await athleteResponse.json()
      const athleteName = athleteData.athlete_name || athleteData.firstname || 'Unknown'
      
      // Now save the dibs with athlete name
        const response = await fetch(`${apiUrl}/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({ dibs: athleteName })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || `Failed to save dibs: ${response.status}`)
        }

        const updatedItem = await response.json()
        // Update local state
      setDibs({ ...dibs, [itemId]: athleteName })
        // Update items array with fresh data from API
        setItems(items.map(item => item.id === itemId ? updatedItem : item))
      } catch (err) {
        console.error('Error saving dibs:', err)
      alert(`Failed to claim segment: ${err.message}`)
      } finally {
        setSavingDibs({ ...savingDibs, [itemId]: false })
    }
  }

  const handleDibsClear = async (itemId) => {
    setSavingDibs({ ...savingDibs, [itemId]: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dibs: null })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to clear dibs: ${response.status}`)
      }

      const updatedItem = await response.json()
      // Update local state
      const newDibs = { ...dibs }
      delete newDibs[itemId]
      setDibs(newDibs)
      // Update items array with fresh data from API
      setItems(items.map(item => item.id === itemId ? updatedItem : item))
    } catch (err) {
      console.error('Error clearing dibs:', err)
      alert(`Failed to clear dibs: ${err.message}`)
    } finally {
      setSavingDibs({ ...savingDibs, [itemId]: false })
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'overall_attempts' ? parseInt(value) || 0 : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Form submission is now handled by handleConfirmSave
    // This prevents default form submission
  }

  const handleConfirmSave = async () => {
    if (!segmentPreview) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Check for duplicate segment before submitting
      if (segmentPreview.strava_segment_id) {
        const duplicate = items.find(item => 
          item.strava_segment_id === segmentPreview.strava_segment_id
        )
        if (duplicate) {
          throw new Error(`This segment already exists: "${duplicate.segment_name}"`)
        }
      }
      
      // Also check by URL as fallback
      if (segmentPreview.strava_url) {
        const duplicate = items.find(item => 
          item.strava_url === segmentPreview.strava_url
        )
        if (duplicate) {
          throw new Error(`This segment URL already exists: "${duplicate.segment_name}"`)
        }
      }
      
      // Prepare data from preview - ensure proper types
      const submitData = {
        segment_name: segmentPreview.segment_name || 'Unnamed Segment',
        distance: segmentPreview.distance != null ? Number(segmentPreview.distance) : null,
        elevation_gain: segmentPreview.elevation_gain != null ? Number(segmentPreview.elevation_gain) : null,
        elevation_loss: segmentPreview.elevation_loss != null ? Number(segmentPreview.elevation_loss) : null,
        crown_holder: segmentPreview.crown_holder || null,
        crown_date: segmentPreview.crown_date || null,
        crown_time: segmentPreview.crown_time || null,
        crown_pace: segmentPreview.crown_pace || null,
        personal_best_time: null,  // Fetched dynamically from Strava when viewing
        personal_best_pace: null,  // Fetched dynamically from Strava when viewing
        personal_attempts: 0,  // Fetched dynamically from Strava when viewing
        overall_attempts: segmentPreview.overall_attempts != null ? Number(segmentPreview.overall_attempts) : 0,
        last_attempt_date: null,  // Fetched dynamically from Strava when viewing
        strava_url: segmentPreview.strava_url || null,
        strava_segment_id: segmentPreview.strava_segment_id != null ? Number(segmentPreview.strava_segment_id) : null,
        polyline: segmentPreview.polyline || null,
        start_latitude: segmentPreview.start_latitude || null,
        start_longitude: segmentPreview.start_longitude || null
      }
      
      console.log('Submitting data:', submitData)

      const response = await fetch(`${apiUrl}/items/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`
        try {
        const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch (e) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text()
            if (errorText) errorMessage = errorText
          } catch (e2) {
            // Ignore if we can't read the error
          }
        }
        throw new Error(errorMessage)
      }

      const newItem = await response.json()
      setItems([...items, newItem])
      setSubmitSuccess(true)
      
      // Reset form and clear preview
      setFormData({
        segment_name: '',
        distance: '',
        elevation_gain: '',
        elevation_loss: '',
        crown_holder: '',
        crown_date: '',
        crown_time: '',
        crown_pace: '',
        overall_attempts: 0,
        strava_url: ''
      })
      setSegmentPreview(null)

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
        <div className="strava-auth-section">
          {stravaConnected ? (
            <>
              <span className="strava-status connected">✓ Connected to Strava</span>
              <button 
                className="strava-button disconnect-button"
                onClick={handleStravaDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button 
              className="strava-button connect-button"
              onClick={handleStravaConnect}
            >
              Connect Strava
            </button>
          )}
        </div>
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
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="strava_url">Strava Segment URL *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    id="strava_url"
                    name="strava_url"
                    value={formData.strava_url}
                    onChange={handleFormChange}
                    placeholder="https://www.strava.com/segments/12345"
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={fetchSegmentMetadata}
                      disabled={fetchingSegment || submitting || !formData.strava_url}
                      className="fetch-button"
                    >
                      {fetchingSegment ? 'Fetching...' : 'Fetch Details'}
                    </button>
                </div>
                  <small style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem', display: 'block' }}>
                    {stravaConnected 
                      ? 'Enter a Strava segment URL and click "Fetch Details" to preview the segment'
                      : 'Connect Strava to add segments'}
                  </small>
              </div>
              </div>
            </form>

            {segmentPreview && (
              <div className="segment-preview-card">
                <h3>Segment Preview</h3>
                <div className="preview-content">
                  <div className="accordion-two-pane">
                    {/* Left Pane - Map */}
                    <div className="accordion-left-pane">
                      {segmentPreview.polyline || segmentPreview.start_latitude ? (
                        <SegmentMap
                          polyline={segmentPreview.polyline}
                          startLatitude={segmentPreview.start_latitude}
                          startLongitude={segmentPreview.start_longitude}
                          segmentName={segmentPreview.segment_name}
                        />
                      ) : (
                        <div className="no-map-placeholder">
                          <p>No map data available</p>
                          <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', opacity: 0.6 }}>
                            The segment may not have map data from Strava
                          </p>
                </div>
                      )}
                </div>

                    {/* Right Pane - Compacted Info */}
                    <div className="accordion-right-pane">
                      <div className="details-section compact">
                        <div className="compact-header">
                          <h3>Overview</h3>
                      {segmentPreview.strava_url && (
                          <a 
                            href={segmentPreview.strava_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                              className="strava-link-inline"
                          >
                              Strava →
                          </a>
                      )}
                  </div>
                        <div className="compact-inline-grid">
                          <span className="compact-inline-item">
                            <span className="compact-label">Name:</span> 
                            <span className="compact-value">{segmentPreview.segment_name}</span>
                          </span>
                          <span className="compact-inline-item">
                            <span className="compact-label">Dist:</span> 
                            <span className="compact-value">{formatDistance(segmentPreview.distance)}</span>
                          </span>
                          <span className="compact-inline-item">
                            <span className="compact-label">Elev:</span> 
                            <span className="compact-value">{formatElevation(segmentPreview.elevation_gain)}</span>
                          </span>
                          <span className="compact-inline-item">
                            <span className="compact-label">ID:</span> 
                            <span className="compact-value">{segmentPreview.strava_segment_id || '—'}</span>
                          </span>
                  </div>
                  </div>
                  
                      <div className="details-section compact">
                        <h3>Crown</h3>
                    {segmentPreview.crown_holder ? (
                          <div className="compact-inline-grid">
                            <span className="compact-inline-item">
                              <span className="compact-label">Holder:</span> 
                              <span className="compact-value">{segmentPreview.crown_holder}</span>
                            </span>
                            <span className="compact-inline-item">
                              <span className="compact-label">Time:</span> 
                              <span className="compact-value">{segmentPreview.crown_time || '—'}</span>
                            </span>
                            <span className="compact-inline-item">
                              <span className="compact-label">Pace:</span> 
                              <span className="compact-value">{segmentPreview.crown_pace || '—'}</span>
                            </span>
                            <span className="compact-inline-item">
                              <span className="compact-label">Date:</span> 
                              <span className="compact-value">{segmentPreview.crown_date || '—'}</span>
                            </span>
                  </div>
                    ) : (
                          <div className="preview-info-message compact-message">
                            <p>Crown info not available via Strava API (deprecated 2020).</p>
                            <p>You can add it manually after saving.</p>
                  </div>
                    )}
              </div>
                </div>
                  </div>

                  <div className="preview-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentPreview(null)
                        setFormData(prev => ({ ...prev, strava_url: '' }))
                      }}
                      className="cancel-button"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSave}
                      className="confirm-button"
                      disabled={submitting}
                    >
                      {submitting ? 'Saving...' : 'Confirm & Save'}
                    </button>
                </div>
                </div>
              </div>
            )}
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
                  <th className="expand-column"></th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('dibs')}
                  >
                    Dibs
                    {sortColumn === 'dibs' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('segment_name')}
                  >
                    Segment Name
                    {sortColumn === 'segment_name' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('strava_segment_id')}
                  >
                    Segment ID
                    {sortColumn === 'strava_segment_id' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('distance')}
                  >
                    Distance
                    {sortColumn === 'distance' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('elevation_gain')}
                  >
                    Elevation Gain
                    {sortColumn === 'elevation_gain' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('crown_holder')}
                  >
                    Crown Holder
                    {sortColumn === 'crown_holder' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                      No active segments found. Create some segments using the API!
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item) => {
                    const isExpanded = expandedRows.has(item.id)
                    const details = segmentDetails[item.id]
                    const isLoadingDetails = loadingDetails[item.id]
                    return (
                      <>
                        <tr 
                          key={item.id} 
                          className={`segment-row ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleRowExpansion(item.id, item)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="expand-cell" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="expand-button"
                              onClick={() => toggleRowExpansion(item.id, item)}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                      <td data-label="Dibs" className="dibs-cell">
                        <div className="dibs-input-wrapper">
                          {item.dibs ? (
                            <div className="dibs-display">
                              <span className="dibs-name">{item.dibs}</span>
                              <button
                                className="dibs-clear-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDibsClear(item.id)
                                }}
                                disabled={savingDibs[item.id]}
                                aria-label="Clear dibs"
                                title="Clear dibs"
                              >
                                {savingDibs[item.id] ? '...' : '×'}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="dibs-claim-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDibsClick(item.id)
                              }}
                              disabled={!stravaConnected || savingDibs[item.id]}
                                aria-label="Claim this segment"
                              title={stravaConnected ? "Claim this segment" : "Connect Strava to claim"}
                            >
                              {savingDibs[item.id] ? '...' : stravaConnected ? 'Claim' : 'Connect'}
                              </button>
                          )}
                        </div>
                      </td>
                      <td className="activity-name" data-label="Segment Name">
                        {item.strava_url ? (
                          <a 
                            href={item.strava_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="segment-name-link"
                                onClick={(e) => e.stopPropagation()}
                          >
                            {formatValue(item.segment_name)}
                          </a>
                        ) : (
                          formatValue(item.segment_name)
                        )}
                      </td>
                          <td data-label="Segment ID">
                            {item.strava_segment_id || extractSegmentId(item.strava_url) || '—'}
                      </td>
                      <td data-label="Distance">{formatDistance(item.distance)}</td>
                      <td data-label="Elevation Gain">{formatElevation(item.elevation_gain)}</td>
                      <td data-label="Crown Holder">{formatValue(item.crown_holder)}</td>
                      <td data-label="Actions" className="actions-cell">
                        <button
                              className="complete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkComplete(item.id, item.segment_name)
                              }}
                              disabled={completingItems[item.id]}
                              aria-label={`Mark ${item.segment_name} as complete`}
                              title="Mark as complete"
                            >
                              {completingItems[item.id] ? '...' : '✓'}
                        </button>
                      </td>
                    </tr>
                        {isExpanded && (
                          <tr className="accordion-details-row">
                            <td colSpan="8" className="accordion-details-cell">
                              <div className="accordion-content">
                                {isLoadingDetails ? (
                                  <div className="loading-details">Loading segment details from Strava...</div>
                                ) : !stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) ? (
                                  <div className="connect-prompt">
                                    <p>Connect Strava to automatically sync your latest times and attempts.</p>
                                    <button 
                                      className="strava-button connect-button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleStravaConnect()
                                      }}
                                    >
                                      Connect Strava
                                    </button>
                                  </div>
                                ) : (
                                  <div className="segment-details">
                                    <div className="accordion-two-pane">
                                      {/* Left Pane - Map */}
                                      <div className="accordion-left-pane">
                                        {(details?.polyline || details?.start_latitude || item.polyline || item.start_latitude) ? (
                                          <SegmentMap
                                            polyline={details?.polyline || item.polyline}
                                            startLatitude={details?.start_latitude || item.start_latitude}
                                            startLongitude={details?.start_longitude || item.start_longitude}
                                            segmentName={item.segment_name}
                                          />
                                        ) : (
                                          <div className="no-map-placeholder">
                                            <p>No map data available</p>
                                          </div>
                                        )}
                                        </div>

                                      {/* Right Pane - Compacted Info */}
                                      <div className="accordion-right-pane">
                                        <div className="details-section compact">
                                          <div className="compact-header">
                                            <h3>Overview</h3>
                                        {item.strava_url && (
                                            <a 
                                              href={item.strava_url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                                className="strava-link-inline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Strava →
                                            </a>
                                            )}
                                          </div>
                                          <div className="compact-inline-grid">
                                            <span className="compact-inline-item"><span className="compact-label">Dist:</span> {formatDistance(item.distance)}</span>
                                            <span className="compact-inline-item"><span className="compact-label">Elev:</span> {formatElevation(item.elevation_gain)}</span>
                                            {item.elevation_loss && (
                                              <span className="compact-inline-item"><span className="compact-label">Loss:</span> {formatElevation(item.elevation_loss)}</span>
                                        )}
                                            <span className="compact-inline-item"><span className="compact-label">Attempts:</span> {formatValue(item.overall_attempts)}</span>
                                      </div>
                                    </div>

                                        <div className="details-section compact">
                                          <div className="compact-header">
                                            <h3>Crown</h3>
                                        {editingCrown === item.id ? (
                                              <div className="compact-buttons">
                                            <button
                                                  className="confirm-button compact-btn"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                saveCrownInfo(item.id)
                                              }}
                                              disabled={savingCrown}
                                            >
                                                  {savingCrown ? '...' : 'Save'}
                                            </button>
                                            <button
                                                  className="cancel-button compact-btn"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                cancelEditingCrown()
                                              }}
                                              disabled={savingCrown}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                                className="strava-button connect-button compact-btn"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              startEditingCrown(item)
                                            }}
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                          {editingCrown === item.id ? (
                                            <div className="compact-inline-grid">
                                            <input
                                              type="text"
                                              value={crownEditData.crown_holder}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_holder: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Holder"
                                              />
                                              <input
                                                type="text"
                                                value={crownEditData.crown_time}
                                                onChange={(e) => setCrownEditData({ ...crownEditData, crown_time: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Time"
                                              />
                                              <input
                                                type="text"
                                                value={crownEditData.crown_pace}
                                                onChange={(e) => setCrownEditData({ ...crownEditData, crown_pace: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Pace"
                                              />
                                            <input
                                              type="text"
                                              value={crownEditData.crown_date}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_date: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Date"
                                              />
                                            </div>
                                          ) : (
                                            <div className="compact-inline-grid">
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Holder:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_holder ? 'highlight' : ''}`}>
                                                  {details && !details.error && details.crown_holder 
                                                    ? details.crown_holder 
                                                    : formatValue(item.crown_holder) || '—'}
                                                  {details && !details.error && details.crown_holder && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Time:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_time ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_time 
                                                ? details.crown_time 
                                                : formatValue(item.crown_time) || '—'}
                                              {details && !details.error && details.crown_time && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Pace:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_pace ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_pace 
                                                ? details.crown_pace 
                                                : formatValue(item.crown_pace) || '—'}
                                              {details && !details.error && details.crown_pace && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Date:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_date ? 'highlight' : ''}`}>
                                                  {details && !details.error && details.crown_date 
                                                    ? details.crown_date 
                                                    : formatValue(item.crown_date) || '—'}
                                                  {details && !details.error && details.crown_date && (
                                                    <span className="strava-badge" title="Synced from Strava">🔄</span>
                                                  )}
                                                </span>
                                              </span>
                                        </div>
                                          )}
                                    </div>

                                        <div className="details-section compact">
                                          <h3>Your Stats</h3>
                                      {isLoadingDetails && (
                                            <div className="strava-syncing compact-sync">
                                              <span>Syncing...</span>
                                        </div>
                                      )}
                                      {details?.error && (
                                            <div className="strava-error compact-error">
                                              {details.error.includes('Rate limit') || details.error.includes('429') ? (
                                                <span>⚠️ Rate limited - showing cached data. {details.error}</span>
                                              ) : details.error.includes('401') || details.error.includes('not connected') || details.error.includes('expired') || details.error.includes('Invalid') ? (
                                                <span>⚠️ {details.error}</span>
                                              ) : (
                                                <span>⚠️ Error syncing: {details.error}</span>
                                              )}
                                          {stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                            <button 
                                                  className="retry-details-button compact-retry"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const segmentId = item.strava_segment_id || extractSegmentId(item.strava_url)
                                                if (segmentId) fetchSegmentDetails(item.id, segmentId)
                                              }}
                                            >
                                              Retry
                                            </button>
                                          )}
                                        </div>
                                      )}
                                          <div className="compact-inline-grid">
                                            <span className="compact-inline-item">
                                              <span className="compact-label">PB:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_best_time ? (
                                              details.personal_best_activity_id ? (
                                                <a 
                                                  href={`https://www.strava.com/activities/${details.personal_best_activity_id}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="strava-link"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {details.personal_best_time}
                                                  <span className="strava-badge" title="Synced from Strava">🔄</span>
                                                </a>
                                              ) : (
                                                <>
                                                  {details.personal_best_time}
                                                  <span className="strava-badge" title="Synced from Strava">🔄</span>
                                                </>
                                              )
                                            ) : (
                                              formatValue(item.personal_best_time) || '—'
                                            )}
                                          </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">Pace:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_best_pace 
                                              ? details.personal_best_pace 
                                              : formatValue(item.personal_best_pace) || '—'}
                                            {details && !details.error && details.personal_best_pace && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">GAP:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_best_grade_adjusted_pace 
                                              ? details.personal_best_grade_adjusted_pace 
                                              : '—'}
                                            {details && !details.error && details.personal_best_grade_adjusted_pace && (
                                              <span className="strava-badge" title="Calculated from Strava data">🔄</span>
                                            )}
                                          </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">#:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_attempts !== null && details.personal_attempts !== undefined
                                              ? details.personal_attempts 
                                              : formatValue(item.personal_attempts) || '0'}
                                            {details && !details.error && details.personal_attempts !== null && details.personal_attempts !== undefined && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">Last:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.last_attempt_date 
                                              ? details.last_attempt_date 
                                              : formatValue(item.last_attempt_date) || '—'}
                                            {details && !details.error && details.last_attempt_date && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                              </span>
                                          </span>
                                      </div>
                                      {!stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                            <div className="connect-prompt compact-prompt">
                                          <button 
                                                className="strava-button connect-button compact-btn"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleStravaConnect()
                                            }}
                                          >
                                            Connect Strava
                                          </button>
                                        </div>
                                      )}
                                      {!stravaConnected && !(item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                            <div className="connect-prompt compact-prompt">
                                              <p className="no-strava-url">No Strava URL</p>
                                        </div>
                                      )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-left">
              <div className="pagination-info">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedActiveItems.length)} of {sortedActiveItems.length} active segments
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

        {/* Completed Segments Table */}
        {sortedCompletedItems.length > 0 && (
          <div style={{ marginTop: '3rem' }}>
            <h2 style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: 600
            }}>
              Completed Segments ({sortedCompletedItems.length})
            </h2>
            <div className="table-container">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th className="expand-column"></th>
                    <th>Dibs</th>
                    <th>Segment Name</th>
                    <th>Segment ID</th>
                    <th>Distance</th>
                    <th>Elevation Gain</th>
                    <th>Crown Holder</th>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompletedItems.map((item) => {
                    const isExpanded = expandedRows.has(item.id)
                    const details = segmentDetails[item.id]
                    const isLoadingDetails = loadingDetails[item.id]
                    return (
                      <>
                        <tr 
                          key={item.id} 
                          className={`segment-row ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleRowExpansion(item.id, item)}
                          style={{ cursor: 'pointer', opacity: 0.7 }}
                        >
                          <td className="expand-cell" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="expand-button"
                              onClick={() => toggleRowExpansion(item.id, item)}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td data-label="Dibs" className="dibs-cell">
                            <div className="dibs-input-wrapper">
                              {item.dibs ? (
                                <div className="dibs-display">
                                  <span className="dibs-name">{item.dibs}</span>
                                  <button
                                    className="dibs-clear-button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDibsClear(item.id)
                                    }}
                                    disabled={savingDibs[item.id]}
                                    aria-label="Clear dibs"
                                    title="Clear dibs"
                                  >
                                    {savingDibs[item.id] ? '...' : '×'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="dibs-claim-button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDibsClick(item.id)
                                  }}
                                  disabled={!stravaConnected || savingDibs[item.id]}
                                  aria-label="Claim this segment"
                                  title={stravaConnected ? "Claim this segment" : "Connect Strava to claim"}
                                >
                                  {savingDibs[item.id] ? '...' : stravaConnected ? 'Claim' : 'Connect'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="activity-name" data-label="Segment Name">
                            {item.strava_url ? (
                              <a 
                                href={item.strava_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="segment-name-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {formatValue(item.segment_name)}
                              </a>
                            ) : (
                              formatValue(item.segment_name)
                            )}
                          </td>
                          <td data-label="Segment ID">
                            {item.strava_segment_id || extractSegmentId(item.strava_url) || '—'}
                          </td>
                          <td data-label="Distance">{formatDistance(item.distance)}</td>
                          <td data-label="Elevation Gain">{formatElevation(item.elevation_gain)}</td>
                          <td data-label="Crown Holder">{formatValue(item.crown_holder)}</td>
                          <td data-label="Actions" className="actions-cell">
                            <button
                              className="complete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkComplete(item.id, item.segment_name)
                              }}
                              disabled={completingItems[item.id]}
                              aria-label={`Mark ${item.segment_name} as incomplete`}
                              title="Mark as incomplete"
                            >
                              {completingItems[item.id] ? '...' : '↩'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="accordion-details-row">
                            <td colSpan="8" className="accordion-details-cell">
                              <div className="accordion-content">
                                {isLoadingDetails ? (
                                  <div className="loading-details">Loading segment details from Strava...</div>
                                ) : (
                                  <div className="segment-details">
                                    <div className="accordion-two-pane">
                                      {/* Left Pane - Map */}
                                      <div className="accordion-left-pane">
                                        {(details?.polyline || details?.start_latitude || item.polyline || item.start_latitude) ? (
                                          <SegmentMap
                                            polyline={details?.polyline || item.polyline}
                                            startLatitude={details?.start_latitude || item.start_latitude}
                                            startLongitude={details?.start_longitude || item.start_longitude}
                                            segmentName={item.segment_name}
                                          />
                                        ) : (
                                          <div className="no-map-placeholder">
                                            <p>No map data available</p>
                                      </div>
                                    )}
                                  </div>

                                      {/* Right Pane - Compacted Info */}
                                      <div className="accordion-right-pane">
                                        <div className="details-section compact">
                                          <div className="compact-header">
                                      <h3>Personal Best</h3>
                                        {details.personal_best_activity_id && (
                                            <a
                                              href={`https://www.strava.com/activities/${details.personal_best_activity_id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                                className="strava-link-inline"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                                Activity →
                                            </a>
                                            )}
                                          </div>
                                          {details?.error && (
                                            <div className="strava-error compact-error">
                                              {details.error.includes('Rate limit') || details.error.includes('429') ? (
                                                <span>⚠️ Rate limited - showing cached data. {details.error}</span>
                                              ) : details.error.includes('401') || details.error.includes('not connected') || details.error.includes('expired') || details.error.includes('Invalid') ? (
                                                <span>⚠️ {details.error}</span>
                                              ) : (
                                                <span>⚠️ Error syncing: {details.error}</span>
                                              )}
                                              {stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                                <button 
                                                  className="retry-details-button compact-retry"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    const segmentId = item.strava_segment_id || extractSegmentId(item.strava_url)
                                                    if (segmentId) fetchSegmentDetails(item.id, segmentId)
                                                  }}
                                                >
                                                  Retry
                                                </button>
                                              )}
                                        </div>
                                          )}
                                          <div className="compact-inline-grid">
                                            <span className="compact-inline-item">
                                              <span className="compact-label">Time:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                                {details && !details.error && details.personal_best_time 
                                                  ? details.personal_best_time 
                                                  : formatValue(item.personal_best_time) || '—'}
                                              </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">Pace:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                                {details && !details.error && details.personal_best_pace 
                                                  ? details.personal_best_pace 
                                                  : formatValue(item.personal_best_pace) || '—'}
                                              </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">GAP:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                                {details && !details.error && details.personal_best_grade_adjusted_pace 
                                                  ? details.personal_best_grade_adjusted_pace 
                                                  : '—'}
                                              </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">#:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                                {details && !details.error && details.personal_attempts !== null && details.personal_attempts !== undefined
                                                  ? details.personal_attempts 
                                                  : formatValue(item.personal_attempts) || '0'}
                                              </span>
                                            </span>
                                            <span className="compact-inline-item">
                                              <span className="compact-label">Last:</span> 
                                              <span className={`compact-value ${details && !details.error ? 'highlight' : ''}`}>
                                                {details && !details.error && details.last_attempt_date 
                                                  ? details.last_attempt_date 
                                                  : formatValue(item.last_attempt_date) || '—'}
                                              </span>
                                          </span>
                                        </div>
                                      </div>
                                        <div className="details-section compact">
                                          <div className="compact-header">
                                            <h3>Crown</h3>
                                        {editingCrown === item.id ? (
                                              <div className="compact-buttons">
                                              <button
                                                  className="confirm-button compact-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                    saveCrownInfo(item.id)
                                                }}
                                                disabled={savingCrown}
                                              >
                                                  {savingCrown ? '...' : 'Save'}
                                              </button>
                                              <button
                                                  className="cancel-button compact-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  cancelEditingCrown()
                                                }}
                                                disabled={savingCrown}
                                              >
                                                Cancel
                                              </button>
                                          </div>
                                        ) : (
                                          <button
                                                className="strava-button connect-button compact-btn"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              startEditingCrown(item)
                                            }}
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                          {editingCrown === item.id ? (
                                            <div className="compact-inline-grid">
                                            <input
                                              type="text"
                                              value={crownEditData.crown_holder}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_holder: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Holder"
                                              />
                                              <input
                                                type="text"
                                                value={crownEditData.crown_time}
                                                onChange={(e) => setCrownEditData({ ...crownEditData, crown_time: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Time"
                                              />
                                              <input
                                                type="text"
                                                value={crownEditData.crown_pace}
                                                onChange={(e) => setCrownEditData({ ...crownEditData, crown_pace: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Pace"
                                              />
                                              <input
                                                type="text"
                                                value={crownEditData.crown_date}
                                                onChange={(e) => setCrownEditData({ ...crownEditData, crown_date: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="crown-edit-input compact-input-inline"
                                                placeholder="Date"
                                              />
                                            </div>
                                          ) : (
                                            <div className="compact-inline-grid">
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Holder:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_holder ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_holder 
                                                ? details.crown_holder 
                                                : formatValue(item.crown_holder) || '—'}
                                              {details && !details.error && details.crown_holder && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Time:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_time ? 'highlight' : ''}`}>
                                            {details && !details.error && details.crown_time 
                                              ? details.crown_time 
                                              : formatValue(item.crown_time) || '—'}
                                            {details && !details.error && details.crown_time && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Pace:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_pace ? 'highlight' : ''}`}>
                                            {details && !details.error && details.crown_pace 
                                              ? details.crown_pace 
                                              : formatValue(item.crown_pace) || '—'}
                                            {details && !details.error && details.crown_pace && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                              </span>
                                              <span className="compact-inline-item">
                                                <span className="compact-label">Date:</span> 
                                                <span className={`compact-value ${details && !details.error && details.crown_date ? 'highlight' : ''}`}>
                                            {details && !details.error && details.crown_date 
                                              ? details.crown_date 
                                              : formatValue(item.crown_date) || '—'}
                                            {details && !details.error && details.crown_date && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                                </span>
                                          </span>
                                        </div>
                                          )}
                                      </div>
                                    </div>
                                  </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
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

