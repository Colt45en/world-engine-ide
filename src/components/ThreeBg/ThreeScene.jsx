/* eslint-disable react/no-unknown-property */
/* cspell:ignore metalness roughness torusKnotGeometry meshStandardMaterial */

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import PropTypes from 'prop-types';
import { useRef } from 'react';

function SpinningKnot() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.7;
      ref.current.rotation.x += delta * 0.35;
    }
  });

  return (
    <mesh ref={ref} position={[0, 0.6, 0]} castShadow>
      <torusKnotGeometry args={[0.55, 0.18, 160, 24]} />
      <meshStandardMaterial color={'#6366F1'} metalness={0.35} roughness={0.35} />
    </mesh>
  );
}

export default function ThreeScene({ className = '' }) {
  return (
    <div className={`three-bg ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.6, 3.2], fov: 55 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} />
        <SpinningKnot />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color={'#0A0A0A'} roughness={1} metalness={0} />
        </mesh>
        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  );
}

ThreeScene.propTypes = {
  className: PropTypes.string,
};
