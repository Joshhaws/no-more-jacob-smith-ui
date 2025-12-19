import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Ensure Leaflet CSS is loaded
if (typeof window !== 'undefined' && !document.querySelector('link[href*="leaflet"]')) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
  link.crossOrigin = ''
  document.head.appendChild(link)
}

// Fix for default marker icons in webpack/vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function SegmentMap({ polyline, startLatitude, startLongitude, segmentName }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const polylineLayerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) {
      console.log('SegmentMap: mapRef.current is null')
      return
    }

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.error('SegmentMap: Leaflet (L) is not defined. Make sure leaflet is installed and imported correctly.')
      return
    }

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const center = startLatitude && startLongitude 
        ? [startLatitude, startLongitude]
        : [37.7749, -122.4194] // Default to San Francisco

      try {
        mapInstanceRef.current = L.map(mapRef.current).setView(center, 13)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)
      } catch (error) {
        console.error('SegmentMap: Error initializing map:', error)
        return
      }
    }

    const map = mapInstanceRef.current

    // Decode polyline and add to map
    if (polyline) {
      // Remove existing polyline if any
      if (polylineLayerRef.current) {
        map.removeLayer(polylineLayerRef.current)
      }

      try {
        // Decode polyline using a simple decoder
        // Strava uses encoded polyline format
        const decoded = decodePolyline(polyline)
        
        if (decoded && decoded.length > 0) {
          // Create polyline layer
          polylineLayerRef.current = L.polyline(decoded, {
            color: '#ff4d00',
            weight: 4,
            opacity: 0.8,
          }).addTo(map)

          // Fit map to polyline bounds
          map.fitBounds(polylineLayerRef.current.getBounds(), {
            padding: [20, 20]
          })

          // Add start marker
          if (decoded[0]) {
            L.marker(decoded[0], {
              icon: L.icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
              })
            }).addTo(map).bindPopup('Start')
          }

          // Add end marker
          if (decoded.length > 1 && decoded[decoded.length - 1]) {
            L.marker(decoded[decoded.length - 1], {
              icon: L.icon({
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
              })
            }).addTo(map).bindPopup('End')
          }
        }
      } catch (error) {
        console.error('Error decoding polyline:', error)
      }
    } else if (startLatitude && startLongitude) {
      // If no polyline but we have coordinates, just show a marker
      map.setView([startLatitude, startLongitude], 13)
      L.marker([startLatitude, startLongitude]).addTo(map).bindPopup(segmentName || 'Segment')
    }

    // Cleanup function
    return () => {
      if (polylineLayerRef.current) {
        map.removeLayer(polylineLayerRef.current)
      }
    }
  }, [polyline, startLatitude, startLongitude, segmentName])

  if (!polyline && !startLatitude) {
    console.log('SegmentMap: No polyline or start coordinates provided', { polyline, startLatitude, startLongitude })
    return null
  }

  return (
    <div 
      ref={mapRef} 
      style={{ 
        height: '400px', 
        width: '100%', 
        borderRadius: '8px', 
        marginTop: '1rem',
        zIndex: 0,
        position: 'relative'
      }} 
    />
  )
}

// Simple polyline decoder for encoded polylines
function decodePolyline(encoded) {
  const poly = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0

  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
    lng += dlng

    poly.push([lat * 1e-5, lng * 1e-5])
  }

  return poly
}

export default SegmentMap

