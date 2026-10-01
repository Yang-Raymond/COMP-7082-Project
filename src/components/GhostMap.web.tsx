
import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

interface LatLng {
  lat: number;
  lng: number;
}

interface GhostMapProps {
  latitude: number;
  longitude: number;
  path?: LatLng[];
  ghostPosition?: LatLng;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps?.Map) return resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export default function GhostMap({ latitude, longitude, path, ghostPosition }: GhostMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const ghostMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Create the map once
  useEffect(() => {
    let cancelled = false;

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set — map will not load on web.');
      return;
    }

    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current) return;
      const google = (window as any).google;

      mapRef.current = new google.maps.Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
      });

      markerRef.current = new google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#4ee6a8',
          fillOpacity: 1,
          strokeColor: '#0d1117',
          strokeWeight: 2,
        },
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the "you are here" marker as new fixes come in
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const pos = { lat: latitude, lng: longitude };
      markerRef.current.setPosition(pos);
      mapRef.current.panTo(pos);
    }
  }, [latitude, longitude]);

  // Draw / update the recorded route line
  useEffect(() => {
    if (!mapRef.current || !path || path.length < 2) return;
    const google = (window as any).google;

    if (polylineRef.current) polylineRef.current.setMap(null);

    polylineRef.current = new google.maps.Polyline({
      path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
      strokeColor: '#4ee6a8',
      strokeWeight: 4,
      map: mapRef.current,
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    mapRef.current.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Draw / move the ghost marker
  useEffect(() => {
    if (!mapRef.current || !ghostPosition) return;
    const google = (window as any).google;

    if (!ghostMarkerRef.current) {
      ghostMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#7d8895',
          fillOpacity: 0.85,
          strokeColor: '#0d1117',
          strokeWeight: 2,
        },
      });
    }
    ghostMarkerRef.current.setPosition({ lat: ghostPosition.lat, lng: ghostPosition.lng });
  }, [ghostPosition]);

  return <View ref={containerRef as any} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
});