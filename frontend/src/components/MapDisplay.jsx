import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapDisplay({ startCoords, endCoords, confirmedPickups = [], requestCoords, vehicleCoords, height = '300px' }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayer = useRef(null);
  const detourLayer = useRef(null);
  const liveRouteLayer = useRef(null);
  const markersGroup = useRef(null);
  const vehicleMarker = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: true
      }).setView([0, 0], 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markersGroup.current = L.featureGroup().addTo(mapInstance.current);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Handle live vehicle position updates (separate effect for performance)
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove old vehicle marker and live route
    if (vehicleMarker.current) {
      vehicleMarker.current.remove();
      vehicleMarker.current = null;
    }
    if (liveRouteLayer.current) {
      mapInstance.current.removeLayer(liveRouteLayer.current);
      liveRouteLayer.current = null;
    }

    if (vehicleCoords && vehicleCoords.lat && vehicleCoords.lon) {
      const carIcon = L.divIcon({
        className: 'vehicle-live-marker',
        html: `<div style="
          background: linear-gradient(135deg, #6c5ce7, #a29bfe);
          color: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border: 3px solid white;
          box-shadow: 0 0 0 5px rgba(108,92,231,0.3), 0 4px 14px rgba(0,0,0,0.25);
        ">🚗</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      vehicleMarker.current = L.marker([vehicleCoords.lat, vehicleCoords.lon], { icon: carIcon, zIndexOffset: 1000 })
        .bindPopup('<b>🚗 Vehicle Location</b><br/>Driver is on the way!')
        .addTo(mapInstance.current);

      // Draw dashed route from vehicle to destination
      if (endCoords && endCoords.lat && endCoords.lon) {
        const drawLiveRoute = async () => {
          try {
            const res = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${vehicleCoords.lon},${vehicleCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson`
            );
            if (res.ok) {
              const data = await res.json();
              if (data.routes && data.routes[0]) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                if (mapInstance.current) {
                  liveRouteLayer.current = L.polyline(coords, {
                    color: '#6c5ce7',
                    weight: 4,
                    opacity: 0.85,
                    dashArray: '10, 6'
                  }).addTo(mapInstance.current);
                }
              }
            }
          } catch (e) {
            console.warn('Could not fetch live route:', e);
          }
        };
        drawLiveRoute();
      }

      // Pan map smoothly to vehicle
      mapInstance.current.panTo([vehicleCoords.lat, vehicleCoords.lon]);
    }
  }, [vehicleCoords, endCoords]);

  // Handle updates to coordinates and routes
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers and route layers
    if (markersGroup.current) {
      markersGroup.current.clearLayers();
    }
    if (routeLayer.current) {
      mapInstance.current.removeLayer(routeLayer.current);
      routeLayer.current = null;
    }
    if (detourLayer.current) {
      mapInstance.current.removeLayer(detourLayer.current);
      detourLayer.current = null;
    }

    const hasStart = startCoords && startCoords.lat && startCoords.lon;
    const hasEnd = endCoords && endCoords.lat && endCoords.lon;
    const hasRequest = requestCoords && requestCoords.lat && requestCoords.lon;

    if (!hasStart && !hasEnd) {
      mapInstance.current.setView([0, 0], 2);
      return;
    }

    const startIcon = L.divIcon({
      className: 'custom-map-marker marker-start',
      html: `<div style="background-color: var(--odoo-violet); color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: var(--shadow-sm);">S</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const destIcon = L.divIcon({
      className: 'custom-map-marker marker-end',
      html: `<div style="background-color: var(--odoo-teal); color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: var(--shadow-sm);">D</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    const requestIcon = L.divIcon({
      className: 'custom-map-marker marker-request',
      html: `<div style="background-color: #e67e22; color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: var(--shadow-sm);">R</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    if (hasStart) {
      L.marker([startCoords.lat, startCoords.lon], { icon: startIcon })
        .bindPopup('<b>Starting Location</b>')
        .addTo(markersGroup.current);
    }

    if (hasEnd) {
      L.marker([endCoords.lat, endCoords.lon], { icon: destIcon })
        .bindPopup('<b>Destination</b>')
        .addTo(markersGroup.current);
    }

    if (confirmedPickups && confirmedPickups.length > 0) {
      confirmedPickups.forEach((pickup, index) => {
        if (pickup && pickup.lat && pickup.lon) {
          const riderIcon = L.divIcon({
            className: `custom-map-marker marker-confirmed-pickup-${index}`,
            html: `<div style="background-color: var(--odoo-teal); color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: var(--shadow-sm);">P${index + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          L.marker([pickup.lat, pickup.lon], { icon: riderIcon })
            .bindPopup(`<b>Passenger Pickup: ${pickup.passenger_name || `Rider ${index + 1}`}</b><br/>${pickup.pickup_location || ''}`)
            .addTo(markersGroup.current);
        }
      });
    }

    if (hasRequest) {
      L.marker([requestCoords.lat, requestCoords.lon], { icon: requestIcon })
        .bindPopup(`<b>Request Pickup: ${requestCoords.passenger_name || 'Pending Rider'}</b><br/>${requestCoords.pickup_location || ''}`)
        .addTo(markersGroup.current);
    }

    const fitBoundsOptions = { padding: [40, 40], maxZoom: 15 };

    const updateRoutes = async () => {
      if (hasStart && hasEnd) {
        const baseStops = [startCoords, ...(confirmedPickups || []), endCoords];
        let routeCoords = baseStops.map(s => [s.lat, s.lon]);
        try {
          const coordsString = baseStops.map(s => `${s.lon},${s.lat}`).join(';');
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
              routeCoords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch OSRM route:', err);
        }
        if (mapInstance.current) {
          routeLayer.current = L.polyline(routeCoords, {
            color: 'var(--odoo-violet)',
            weight: 4,
            opacity: 0.85
          }).addTo(mapInstance.current);
        }
      }

      if (hasStart && hasEnd && hasRequest) {
        const detourStops = [startCoords, ...(confirmedPickups || []), requestCoords, endCoords];
        let detourCoords = detourStops.map(s => [s.lat, s.lon]);
        try {
          const coordsString = detourStops.map(s => `${s.lon},${s.lat}`).join(';');
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
              detourCoords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch OSRM detour route:', err);
        }
        if (mapInstance.current) {
          detourLayer.current = L.polyline(detourCoords, {
            color: '#e67e22',
            weight: 3.5,
            dashArray: '8, 8',
            opacity: 0.95
          }).addTo(mapInstance.current);
        }
      }

      setTimeout(() => {
        if (!mapInstance.current) return;
        mapInstance.current.invalidateSize();
        const layersCount = markersGroup.current.getLayers().length;
        if (layersCount === 1) {
          const singleMarker = markersGroup.current.getLayers()[0];
          mapInstance.current.setView(singleMarker.getLatLng(), 15);
        } else if (layersCount > 1) {
          mapInstance.current.fitBounds(markersGroup.current.getBounds(), fitBoundsOptions);
        }
      }, 150);
    };

    updateRoutes();
  }, [startCoords, endCoords, confirmedPickups, requestCoords]);

  const [isFullScreen, setIsFullScreen] = React.useState(false);

  return (
    <div style={
      isFullScreen 
        ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: '#ffffff', display: 'flex', flexDirection: 'column' }
        : { position: 'relative', width: '100%', height }
    }>
      <button 
        type="button"
        onClick={(e) => { e.preventDefault(); setIsFullScreen(!isFullScreen); setTimeout(() => { if (mapInstance.current) mapInstance.current.invalidateSize(); }, 300); }}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: '#000000',
          color: '#ffffff',
          border: 'none',
          padding: '0.6rem 1rem',
          fontWeight: 700,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
      >
        {isFullScreen ? 'CLOSE MAP' : 'EXPAND MAP'}
      </button>
      <div 
        ref={mapRef} 
        style={{ 
          height: isFullScreen ? '100%' : '100%', 
          width: '100%', 
          borderRadius: isFullScreen ? '0' : 'var(--radius-md)', 
          border: isFullScreen ? 'none' : '2px solid #000000',
          zIndex: 1,
          flex: 1
        }} 
      />
    </div>
  );
}
