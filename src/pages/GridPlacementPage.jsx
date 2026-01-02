/* eslint-disable react/no-unknown-property */
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import { PlacementSystem } from '../placement/PlacementSystem';
import { Terrain } from '../terrain/Terrain';
import { HudRoot } from '../ui/HudRoot';

export function GridPlacementPage() {
  const [mode, setMode] = useState('tile');
  const cubeSize = 2;

  return (
    <div style={{ padding: 16 }}>
      <HudRoot />
      <h1>Grid Placement</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setMode('tile')} style={{ padding: '8px 10px' }}>
          Tile
        </button>
        <button onClick={() => setMode('tree')} style={{ padding: '8px 10px' }}>
          Tree
        </button>
        <button onClick={() => setMode('prop')} style={{ padding: '8px 10px' }}>
          Prop
        </button>
        <div style={{ marginLeft: 8, fontSize: 12 }}>
          Mode: <strong>{mode}</strong> — Rotate: Q/E
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: 720,
          border: '1px solid #ddd',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Canvas shadows camera={{ position: [18, 18, 18], fov: 55 }}>
          <ambientLight intensity={0.5} />
          <directionalLight castShadow position={[20, 30, 10]} intensity={1} />

          <Terrain radius={80} step={1} />
          <PlacementSystem cubeSize={cubeSize} mode={mode} />

          <OrbitControls enablePan={false} enableZoom={true} />
        </Canvas>
      </div>
    </div>
  );
}
