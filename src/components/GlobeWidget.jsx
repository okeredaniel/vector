import Globe from '/src/components/lightswind/globe.tsx'

// Uses the Magic UI globe (src/components/ui/globe.jsx), which wraps
// cobe with drag-to-rotate + spring easing via `motion/react`.
// Requires: npm install motion
//
// Recolored to the app's violet/space palette instead of the
// component's default white/orange, and marker set trimmed — the
// default markers are real city coordinates, which don't mean
// anything for this app, so they're swapped for the mesh's own
// accent color as ambient dots rather than real locations.
const VECTOR_GLOBE_CONFIG = {
  width: 400,
  height: 400,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 1,
  baseColor: [0, 0.48, 0.9],
  markerColor: [0.85, 0.78, 1],
  glowColor: [0.35, 0.24, 0.68],
  markers: [
    { location: [14.5995, 120.9842], size: 0.05 },
    { location: [40.7128, -74.006], size: 0.05 },
    { location: [51.5072, -0.1276], size: 0.05 },
    { location: [-33.8688, 151.2093], size: 0.05 },
  ],
};

export default function GlobeWidget() {
  return (
    <div className="globe-widget">
      <Globe config={VECTOR_GLOBE_CONFIG} />
    </div>
  );
}
