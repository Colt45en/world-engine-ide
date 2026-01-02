/* eslint-disable react/no-unknown-property */
import PropTypes from 'prop-types';
import { useMemo } from 'react';
import * as THREE from 'three';
import { heightAt } from './terrainField';

export function Terrain({ radius = 80, step = 1 }) {
  const geom = useMemo(() => {
    const size = radius * 2;
    const segments = Math.max(2, Math.floor(size / step));

    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);

    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [radius, step]);

  return (
    <mesh geometry={geom} receiveShadow userData={{ placeableSurface: true }}>
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </mesh>
  );
}

Terrain.propTypes = {
  radius: PropTypes.number,
  step: PropTypes.number,
};
