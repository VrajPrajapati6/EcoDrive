import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapDisplay({ startCoords, endCoords, confirmedPickups = [], requestCoords, height = '300px' }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayer = useRef(null);
  const detourLayer = useRef(null);
  const markersGroup = useRef(null);

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
      // Zoom out to global view if no coordinates are selected
      mapInstance.current.setView([0, 0], 2);
      return;
    }

    // Create custom styled icons to avoid missing marker image issues in Vite
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

    // Add Start Marker
    if (hasStart) {
      L.marker([startCoords.lat, startCoords.lon], { icon: startIcon })
        .bindPopup('<b>Starting Location</b>')
        .addTo(markersGroup.current);
    }

    // Add Destination Marker
    if (hasEnd) {
      L.marker([endCoords.lat, endCoords.lon], { icon: destIcon })
        .bindPopup('<b>Destination</b>')
        .addTo(markersGroup.current);
    }

    // Add Confirmed Passenger Pickup Markers
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

    // Add Passenger Pending Request Pickup Marker
    if (hasRequest) {
      L.marker([requestCoords.lat, requestCoords.lon], { icon: requestIcon })
        .bindPopup(`<b>Request Pickup: ${requestCoords.passenger_name || 'Pending Rider'}</b><br/>${requestCoords.pickup_location || ''}`)
        .addTo(markersGroup.current);
    }

    const fitBoundsOptions = { padding: [40, 40], maxZoom: 15 };

    const updateRoutes = async () => {
      // 1. Fetch & draw original route: Start -> Confirmed Pickups -> End
      if (hasStart && hasEnd) {
        const baseStops = [
          startCoords,
          ...(confirmedPickups || []),
          endCoords
        ];
        
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
          console.warn('Failed to fetch OSRM route, falling back to straight lines:', err);
        }

        routeLayer.current = L.polyline(routeCoords, {
          color: 'var(--odoo-violet)',
          weight: 4,
          opacity: 0.85
        }).addTo(mapInstance.current);
      }

      // 2. Fetch & draw detour route if a pending request is active: Start -> Confirmed Pickups -> Request Pickup -> End
      if (hasStart && hasEnd && hasRequest) {
        const detourStops = [
          startCoords,
          ...(confirmedPickups || []),
          requestCoords,
          endCoords
        ];

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
          console.warn('Failed to fetch OSRM detour route, falling back to straight lines:', err);
        }

        detourLayer.current = L.polyline(detourCoords, {
          color: '#e67e22',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.95
        }).addTo(mapInstance.current);
      }

      // Adjust map view to fit all markers
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

  return (
    <div 
      ref={mapRef} 
      style={{ 
        height, 
        width: '100%', 
        borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 1
      }} 
    />
  );
}
