import React from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { colors } from '../constants/ghostTheme';

interface LatLng {
  lat: number;
  lng: number;
}

const PAD = 3;

/** The outline of a route, scaled to fit a small box. A shape, not a map. */
export default function RouteSketch({ points, width = 72, height = 48 }: { points: LatLng[]; width?: number; height?: number }) {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);
  // A degree of longitude gets shorter away from the equator; without this the shape looks stretched sideways
  const k = Math.cos(((minLat + Math.max(...lats)) / 2) * (Math.PI / 180));
  const w = (Math.max(...lngs) - minLng) * k;
  const h = Math.max(...lats) - minLat;
  const scale = Math.min((width - PAD * 2) / (w || 1), (height - PAD * 2) / (h || 1));
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;

  const xy = points
    .map((p) => `${ox + (p.lng - minLng) * k * scale},${height - oy - (p.lat - minLat) * scale}`)
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={xy} fill="none" stroke={colors.blue} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
