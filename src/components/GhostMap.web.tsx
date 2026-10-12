
import { useEffect, useRef, useState } from 'react';
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
  showUser?: boolean;
  fitPath?: boolean;
  pathColor?: string;
  interactive?: boolean;
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

export default function GhostMap({
  latitude,
  longitude,
  path,
  ghostPosition,
  showUser = true,
  fitPath = false,
  pathColor = '#1a73e8',
  interactive = true,
}: GhostMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const userRef = useRef<any>(null);
  const ghostRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

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
        clickableIcons: false,
        gestureHandling: interactive ? 'greedy' : 'none',
      });

      if (showUser) {
        userRef.current = new google.maps.Marker({
          position: { lat: latitude, lng: longitude },
          map: mapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#1a73e8',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
   
  }, []);


  useEffect(() => {
    if (!ready || !userRef.current) return;
    const pos = { lat: latitude, lng: longitude };
    userRef.current.setPosition(pos);
    if (!fitPath) mapRef.current.panTo(pos);
  }, [ready, latitude, longitude, fitPath]);

  
  useEffect(() => {
    if (!ready) return;
    const google = (window as any).google;
    if (lineRef.current) lineRef.current.setMap(null);
    if (!path || path.length < 2) return;

    lineRef.current = new google.maps.Polyline({
      path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
      strokeColor: pathColor,
      strokeWeight: 4,
      map: mapRef.current,
    });

    if (fitPath) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapRef.current.fitBounds(bounds, 24);
    }
  }, [ready, path, fitPath, pathColor]);

 
  useEffect(() => {
    if (!ready || !ghostPosition) return;
    const google = (window as any).google;
    if (!ghostRef.current) {
      ghostRef.current = new google.maps.Marker({
        map: mapRef.current,
        label: '👻',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#6b0f2e',
          strokeWeight: 2,
        },
      });
    }
    ghostRef.current.setPosition({ lat: ghostPosition.lat, lng: ghostPosition.lng });
  }, [ready, ghostPosition]);

  return <View ref={containerRef as any} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
});