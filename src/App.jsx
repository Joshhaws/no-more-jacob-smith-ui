import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [dibs, setDibs] = useState({})
  const [tempDibs, setTempDibs] = useState({})
  const [savingDibs, setSavingDibs] = useState({}) // Track which dibs are being saved
  const [deletingItems, setDeletingItems] = useState({}) // Track which items are being deleted
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
    difficulty: '',
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
      // Clear any temp dibs when fetching fresh data
      setTempDibs({})
    } catch (err) {
      setError(err.message)
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkStravaStatus = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/auth/strava/status`)
      if (response.ok) {
        const data = await response.json()
        setStravaConnected(data.connected)
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
        difficulty: null,
        strava_url: metadata.strava_url || formData.strava_url,
        strava_segment_id: metadata.segment_id || extractSegmentId(metadata.strava_url || formData.strava_url),
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
      case 'difficulty':
        return item.difficulty ?? Infinity
      case 'last_attempt_date':
        return item.last_attempt_date || ''
      default:
        return ''
    }
  }

  const sortedItems = [...items].sort((a, b) => {
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

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = sortedItems.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)

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

  const handleDelete = async (itemId, segmentName) => {
    if (!window.confirm(`Are you sure you want to delete "${segmentName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingItems({ ...deletingItems, [itemId]: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/items/${itemId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to delete segment: ${response.status}`)
      }

      // Remove from items array
      setItems(items.filter(item => item.id !== itemId))
      // Remove from dibs if it exists
      const newDibs = { ...dibs }
      delete newDibs[itemId]
      setDibs(newDibs)
      // Remove from tempDibs if it exists
      const newTempDibs = { ...tempDibs }
      delete newTempDibs[itemId]
      setTempDibs(newTempDibs)
      
      // Reset to page 1 if current page would be empty
      const remainingItems = items.filter(item => item.id !== itemId)
      const maxPage = Math.ceil(remainingItems.length / itemsPerPage)
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage)
      }
    } catch (err) {
      console.error('Error deleting segment:', err)
      alert(`Failed to delete segment: ${err.message}`)
    } finally {
      setDeletingItems({ ...deletingItems, [itemId]: false })
    }
  }

  const handleDibsSave = async (itemId) => {
    const trimmedValue = (tempDibs[itemId] || '').trim()
    if (trimmedValue) {
      setSavingDibs({ ...savingDibs, [itemId]: true })
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dibs: trimmedValue })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || `Failed to save dibs: ${response.status}`)
        }

        const updatedItem = await response.json()
        // Update local state
        setDibs({ ...dibs, [itemId]: trimmedValue })
        // Update items array with fresh data from API
        setItems(items.map(item => item.id === itemId ? updatedItem : item))
        // Clear temp value after saving
        const newTempDibs = { ...tempDibs }
        delete newTempDibs[itemId]
        setTempDibs(newTempDibs)
      } catch (err) {
        console.error('Error saving dibs:', err)
        alert(`Failed to save dibs: ${err.message}`)
      } finally {
        setSavingDibs({ ...savingDibs, [itemId]: false })
      }
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
      // Also clear temp value
      const newTempDibs = { ...tempDibs }
      delete newTempDibs[itemId]
      setTempDibs(newTempDibs)
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
        difficulty: segmentPreview.difficulty != null ? Number(segmentPreview.difficulty) : null,
        last_attempt_date: null,  // Fetched dynamically from Strava when viewing
        strava_url: segmentPreview.strava_url || null,
        strava_segment_id: segmentPreview.strava_segment_id != null ? Number(segmentPreview.strava_segment_id) : null
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
        difficulty: '',
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
                  <div className="preview-section">
                    <h4>Basic Information</h4>
                    <div className="preview-grid">
                      <div className="preview-item">
                        <span className="preview-label">Segment Name:</span>
                        <span className="preview-value">{segmentPreview.segment_name}</span>
                      </div>
                      <div className="preview-item">
                        <span className="preview-label">Distance:</span>
                        <span className="preview-value">{formatDistance(segmentPreview.distance)}</span>
                      </div>
                      <div className="preview-item">
                        <span className="preview-label">Elevation Gain:</span>
                        <span className="preview-value">{formatElevation(segmentPreview.elevation_gain)}</span>
                      </div>
                      <div className="preview-item">
                        <span className="preview-label">Segment ID:</span>
                        <span className="preview-value">{segmentPreview.strava_segment_id || '—'}</span>
                      </div>
                      {segmentPreview.strava_url && (
                        <div className="preview-item">
                          <span className="preview-label">Strava Link:</span>
                          <a 
                            href={segmentPreview.strava_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="strava-link"
                          >
                            View on Strava →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="preview-section">
                    <h4>Crown Information</h4>
                    {segmentPreview.crown_holder ? (
                      <div className="preview-grid">
                        <div className="preview-item">
                          <span className="preview-label">Crown Holder:</span>
                          <span className="preview-value">{segmentPreview.crown_holder}</span>
                        </div>
                        <div className="preview-item">
                          <span className="preview-label">Crown Time:</span>
                          <span className="preview-value">{segmentPreview.crown_time || '—'}</span>
                        </div>
                        <div className="preview-item">
                          <span className="preview-label">Crown Pace:</span>
                          <span className="preview-value">{segmentPreview.crown_pace || '—'}</span>
                        </div>
                        <div className="preview-item">
                          <span className="preview-label">Crown Date:</span>
                          <span className="preview-value">{segmentPreview.crown_date || '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="preview-info-message">
                        <p>Crown information is not available via the Strava API (deprecated in 2020).</p>
                        <p>You can manually enter this information after saving, or view it on <a href={segmentPreview.strava_url} target="_blank" rel="noopener noreferrer">Strava</a>.</p>
                      </div>
                    )}
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
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('difficulty')}
                  >
                    Difficulty
                    {sortColumn === 'difficulty' && (
                      <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                      No segments found. Create some segments using the API!
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
                                onClick={() => handleDibsClear(item.id)}
                                disabled={savingDibs[item.id]}
                                aria-label="Clear dibs"
                                title="Clear dibs"
                              >
                                {savingDibs[item.id] ? '...' : '×'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                className="dibs-input"
                                placeholder="Input name"
                                value={tempDibs[item.id] !== undefined ? tempDibs[item.id] : (item.dibs || '')}
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
                                disabled={savingDibs[item.id]}
                                aria-label="Save dibs"
                                title="Save"
                              >
                                {savingDibs[item.id] ? '...' : '✓'}
                              </button>
                            </>
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
                          <td data-label="Difficulty">{formatValue(item.difficulty)}</td>
                          <td data-label="Actions" className="actions-cell">
                            <button
                              className="delete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(item.id, item.segment_name)
                              }}
                              disabled={deletingItems[item.id]}
                              aria-label={`Delete ${item.segment_name}`}
                              title="Delete segment"
                            >
                              {deletingItems[item.id] ? '...' : '🗑️'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="accordion-details-row">
                            <td colSpan="9" className="accordion-details-cell">
                              <div className="accordion-content">
                                {isLoadingDetails ? (
                                  <div className="loading-details">Loading segment details from Strava...</div>
                                ) : details?.error ? (
                                  <div className="error-details">
                                    {details.error.includes('401') || details.error.includes('not connected') || details.error.includes('expired') || details.error.includes('Invalid') ? (
                                      <div>
                                        <p>{details.error}</p>
                                        <button 
                                          className="strava-button connect-button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleStravaConnect()
                                          }}
                                        >
                                          Connect/Reconnect Strava
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <p>Error loading details: {details.error}</p>
                                        {(item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                          <button 
                                            className="retry-details-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const segmentId = item.strava_segment_id || extractSegmentId(item.strava_url)
                                              if (segmentId) fetchSegmentDetails(item.id, segmentId)
                                            }}
                                          >
                                            Retry
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
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
                                    <div className="details-section">
                                      <h3>Segment Overview</h3>
                                      <div className="details-grid">
                                        <div className="detail-item">
                                          <span className="detail-label">Distance:</span>
                                          <span className="detail-value">{formatDistance(item.distance)}</span>
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Elevation Gain:</span>
                                          <span className="detail-value">{formatElevation(item.elevation_gain)}</span>
                                        </div>
                                        {item.elevation_loss && (
                                          <div className="detail-item">
                                            <span className="detail-label">Elevation Loss:</span>
                                            <span className="detail-value">{formatElevation(item.elevation_loss)}</span>
                                          </div>
                                        )}
                                        <div className="detail-item">
                                          <span className="detail-label">Overall Attempts:</span>
                                          <span className="detail-value">{formatValue(item.overall_attempts)}</span>
                                        </div>
                                        {item.strava_url && (
                                          <div className="detail-item">
                                            <span className="detail-label">Strava Link:</span>
                                            <a 
                                              href={item.strava_url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="strava-link"
                                            >
                                              View on Strava →
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="details-section">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3>Crown Information</h3>
                                        {editingCrown === item.id ? (
                                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                              className="confirm-button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                saveCrownInfo(item.id)
                                              }}
                                              disabled={savingCrown}
                                              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                            >
                                              {savingCrown ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              className="cancel-button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                cancelEditingCrown()
                                              }}
                                              disabled={savingCrown}
                                              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            className="strava-button connect-button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              startEditingCrown(item)
                                            }}
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                          >
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                      <div className="details-grid">
                                        <div className="detail-item">
                                          <span className="detail-label">Crown Holder:</span>
                                          {editingCrown === item.id ? (
                                            <input
                                              type="text"
                                              value={crownEditData.crown_holder}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_holder: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="crown-edit-input"
                                              placeholder="Enter crown holder name"
                                            />
                                          ) : (
                                            <span className={`detail-value ${details && !details.error && details.crown_holder ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_holder 
                                                ? details.crown_holder 
                                                : formatValue(item.crown_holder) || '—'}
                                              {details && !details.error && details.crown_holder && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Crown Date:</span>
                                          {editingCrown === item.id ? (
                                            <input
                                              type="text"
                                              value={crownEditData.crown_date}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_date: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="crown-edit-input"
                                              placeholder="e.g., 12-Aug-25"
                                            />
                                          ) : (
                                            <span className={`detail-value ${details && !details.error && details.crown_date ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_date 
                                                ? details.crown_date 
                                                : formatValue(item.crown_date) || '—'}
                                              {details && !details.error && details.crown_date && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Crown Time:</span>
                                          {editingCrown === item.id ? (
                                            <input
                                              type="text"
                                              value={crownEditData.crown_time}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_time: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="crown-edit-input"
                                              placeholder="e.g., 22:55"
                                            />
                                          ) : (
                                            <span className={`detail-value ${details && !details.error && details.crown_time ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_time 
                                                ? details.crown_time 
                                                : formatValue(item.crown_time) || '—'}
                                              {details && !details.error && details.crown_time && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Crown Pace:</span>
                                          {editingCrown === item.id ? (
                                            <input
                                              type="text"
                                              value={crownEditData.crown_pace}
                                              onChange={(e) => setCrownEditData({ ...crownEditData, crown_pace: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="crown-edit-input"
                                              placeholder="e.g., 8:35"
                                            />
                                          ) : (
                                            <span className={`detail-value ${details && !details.error && details.crown_pace ? 'highlight' : ''}`}>
                                              {details && !details.error && details.crown_pace 
                                                ? details.crown_pace 
                                                : formatValue(item.crown_pace) || '—'}
                                              {details && !details.error && details.crown_pace && (
                                                <span className="strava-badge" title="Synced from Strava">🔄</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="details-section">
                                      <h3>Your Personal Stats</h3>
                                      {isLoadingDetails && (
                                        <div className="strava-syncing">
                                          <span>Syncing with Strava...</span>
                                        </div>
                                      )}
                                      {details?.error && (
                                        <div className="strava-error">
                                          <span>Unable to sync with Strava: {details.error}</span>
                                          {stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                            <button 
                                              className="retry-details-button"
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
                                      <div className="details-grid">
                                        <div className="detail-item">
                                          <span className="detail-label">Personal Best Effort:</span>
                                          <span className={`detail-value ${details && !details.error ? 'highlight' : ''}`}>
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
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Personal Best Pace:</span>
                                          <span className={`detail-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_best_pace 
                                              ? details.personal_best_pace 
                                              : formatValue(item.personal_best_pace) || '—'}
                                            {details && !details.error && details.personal_best_pace && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Grade Adjusted Pace:</span>
                                          <span className={`detail-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_best_grade_adjusted_pace 
                                              ? details.personal_best_grade_adjusted_pace 
                                              : '—'}
                                            {details && !details.error && details.personal_best_grade_adjusted_pace && (
                                              <span className="strava-badge" title="Calculated from Strava data">🔄</span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Your Attempts:</span>
                                          <span className={`detail-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.personal_attempts !== null && details.personal_attempts !== undefined
                                              ? details.personal_attempts 
                                              : formatValue(item.personal_attempts) || '0'}
                                            {details && !details.error && details.personal_attempts !== null && details.personal_attempts !== undefined && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="detail-item">
                                          <span className="detail-label">Last Attempt:</span>
                                          <span className={`detail-value ${details && !details.error ? 'highlight' : ''}`}>
                                            {details && !details.error && details.last_attempt_date 
                                              ? details.last_attempt_date 
                                              : formatValue(item.last_attempt_date) || '—'}
                                            {details && !details.error && details.last_attempt_date && (
                                              <span className="strava-badge" title="Synced from Strava">🔄</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      {!stravaConnected && (item.strava_segment_id || extractSegmentId(item.strava_url)) && (
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
                                      )}
                                      {!stravaConnected && !(item.strava_segment_id || extractSegmentId(item.strava_url)) && (
                                        <div className="connect-prompt">
                                          <p className="no-strava-url">This segment doesn't have a Strava URL. Add one to enable automatic syncing.</p>
                                        </div>
                                      )}
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
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedItems.length)} of {sortedItems.length} segments
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

