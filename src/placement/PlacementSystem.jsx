/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */
import { useFrame, useThree } from '@react-three/fiber';
import PropTypes from 'prop-types';
import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getBus } from '../bus/bus';
import { FACES, anchorToWorld, faceFromNormal, faceNormal, worldToCell } from '../grid/grid';
import { heightAt, normalAt } from '../terrain/terrainField';
import { Occupancy } from './occupancy';

function Tile({ cubeSize, position, yaw }) {
  const h = cubeSize * 0.1;
  return (
    <mesh position={position} rotation={[0, yaw, 0]} castShadow receiveShadow>
      <boxGeometry args={[cubeSize, h, cubeSize]} />
      <meshStandardMaterial roughness={0.8} />
    </mesh>
  );
}

function Tree({ cubeSize, position, yaw }) {
  const trunkH = cubeSize * 0.9;
  const trunkR = cubeSize * 0.12;
  const canopyH = cubeSize * 0.9;
  const canopyR = cubeSize * 0.45;

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh castShadow receiveShadow position={[0, trunkH * 0.5, 0]}>
        <cylinderGeometry args={[trunkR, trunkR, trunkH, 12]} />
        <meshStandardMaterial roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, trunkH + canopyH * 0.5, 0]}>
        <coneGeometry args={[canopyR, canopyH, 14]} />
        <meshStandardMaterial roughness={0.9} />
      </mesh>
    </group>
  );
}

function PropBox({ cubeSize, position, quaternion }) {
  const size = cubeSize * 0.5;
  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial roughness={0.6} />
    </mesh>
  );
}

function getWorldNormal(hit) {
  if (!hit || !hit.face || !hit.face.normal) return new THREE.Vector3(0, 1, 0);
  const n = hit.face.normal.clone();
  n.transformDirection(hit.object.matrixWorld);
  return n.normalize();
}

function snapAngleRad(angleRad, stepDeg) {
  const step = (stepDeg * Math.PI) / 180;
  return Math.round(angleRad / step) * step;
}

function quaternionForFace(face, yawRad, yawStepDeg) {
  const fn = faceNormal(face);
  const faceN = new THREE.Vector3(fn.x, fn.y, fn.z).normalize();
  const modelForward = new THREE.Vector3(0, 0, 1);

  const qAlign = new THREE.Quaternion().setFromUnitVectors(modelForward, faceN);
  const yawSnapped = snapAngleRad(yawRad || 0, yawStepDeg || 90);
  const qSpin = new THREE.Quaternion().setFromAxisAngle(faceN, yawSnapped);

  // Spin AFTER alignment, around the face normal in world space.
  return qSpin.multiply(qAlign);
}

/**
 * Uniform voxel/grid placement system.
 * - Snaps to cube grid in 3D.
 * - Anchors every object to a (cell, face).
 * - Stores occupancy keyed by (cell, face), not floats.
 */
export function PlacementSystem({ cubeSize = 2, mode = 'tile', yawStepDeg = 90 }) {
  const { camera, gl, scene } = useThree();
  const bus = useMemo(() => getBus(), []);

  const occ = useMemo(() => new Occupancy(), []);
  const [anchors, setAnchors] = useState(() => occ.all());

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useRef(new THREE.Vector2(0, 0));

  const yawRef = useRef(0);
  const [ghost, setGhost] = useState(null);

  const lastSignalsRef = useRef({
    gridKey: '',
    face: '',
    yawSnap: Number.NaN,
    fieldGridKey: '',
    lastFieldAtMs: 0,
  });

  function updatePointer(event) {
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function intersectPlaceableSurface() {
    raycaster.setFromCamera(pointerNdc.current, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
      if (h && h.object && h.object.userData && h.object.userData.placeableSurface) return h;
    }
    return null;
  }

  function computePlacement() {
    const hit = intersectPlaceableSurface();
    if (!hit) return null;

    const p = hit.point;
    const wn = getWorldNormal(hit);

    const cell = worldToCell({ x: p.x, y: p.y, z: p.z }, cubeSize);
    const face = mode === 'tile' || mode === 'tree' ? FACES.Top : faceFromNormal(wn);

    // Signal layer: emit important math/placement transformations, but only when they change.
    const gridKey = `${cell[0]},${cell[1]},${cell[2]}|${cubeSize}`;
    const yawSnapped = snapAngleRad(yawRef.current || 0, yawStepDeg || 90);
    const last = lastSignalsRef.current;

    if (gridKey !== last.gridKey) {
      last.gridKey = gridKey;
      bus.emit({
        channel: 'PLACEMENT',
        type: 'GRID_SNAP',
        payload: {
          world: { x: p.x, y: p.y, z: p.z },
          cell: { i: cell[0], j: cell[1], k: cell[2] },
          cubeSize,
        },
      });
    }

    if (face !== last.face) {
      last.face = face;
      bus.emit({
        channel: 'PLACEMENT',
        type: 'FACE_RESOLVE',
        payload: {
          normal: { x: wn.x, y: wn.y, z: wn.z },
          face,
        },
      });
    }

    if (!Number.isFinite(last.yawSnap) || Math.abs(yawSnapped - last.yawSnap) > 1e-12) {
      last.yawSnap = yawSnapped;
      const q = quaternionForFace(face, yawSnapped, yawStepDeg);
      bus.emit({
        channel: 'MATH',
        type: 'ORIENTATION',
        payload: {
          face,
          spinRad: yawSnapped,
          quaternion: [q.x, q.y, q.z, q.w],
        },
      });
    }

    // Terrain / field sample at current world XZ (for calibration + seam debugging).
    const now = Date.now();
    const shouldEmitField = gridKey !== last.fieldGridKey || now - last.lastFieldAtMs >= 250;
    if (shouldEmitField) {
      last.fieldGridKey = gridKey;
      last.lastFieldAtMs = now;

      const fieldHeight = heightAt(p.x, p.z);
      const fieldNormal = normalAt(p.x, p.z);

      bus.emit({
        channel: 'MATH',
        type: 'FIELD_SAMPLE',
        payload: {
          x: p.x,
          z: p.z,
          height: fieldHeight,
          normal: fieldNormal,
          energy: null,
        },
      });

      bus.emit({
        channel: 'PHYSICS',
        type: 'SURFACE_SAMPLE',
        payload: {
          x: p.x,
          z: p.z,
          y: fieldHeight,
          normal: fieldNormal,
        },
      });
    }

    const faceCenter = anchorToWorld(cell, face, cubeSize);

    // Small push-out along the hit normal so wall props don't z-fight the face plane.
    const pushOut = 0.02;
    const push = { x: wn.x * pushOut, y: wn.y * pushOut, z: wn.z * pushOut };

    const tileThickness = cubeSize * 0.1;
    const yOffset = mode === 'tile' && face === FACES.Top ? tileThickness * 0.5 : 0;

    const anchored = [
      faceCenter.x + push.x,
      faceCenter.y + yOffset + push.y,
      faceCenter.z + push.z,
    ];
    const ok = !occ.has(cell, face);

    return { cell, face, position: anchored, ok };
  }

  useFrame(() => {
    const placement = computePlacement();
    if (!placement) {
      if (ghost !== null) setGhost(null);
      return;
    }

    setGhost((prev) => {
      if (!prev) return placement;
      const [px, py, pz] = prev.position;
      const [nx, ny, nz] = placement.position;
      if (
        prev.ok === placement.ok &&
        prev.face === placement.face &&
        prev.cell[0] === placement.cell[0] &&
        prev.cell[1] === placement.cell[1] &&
        prev.cell[2] === placement.cell[2] &&
        Math.abs(px - nx) < 1e-6 &&
        Math.abs(py - ny) < 1e-6 &&
        Math.abs(pz - nz) < 1e-6
      ) {
        return prev;
      }
      return placement;
    });
  });

  React.useEffect(() => {
    const el = gl.domElement;
    const onMove = (e) => updatePointer(e);
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [gl.domElement]);

  React.useEffect(() => {
    const el = gl.domElement;

    const onKeyDown = (e) => {
      const step = (yawStepDeg * Math.PI) / 180;
      if (e.key === 'q' || e.key === 'Q') yawRef.current -= step;
      if (e.key === 'e' || e.key === 'E') yawRef.current += step;
    };

    const onClick = () => {
      const placement = computePlacement();
      if (!placement || !placement.ok) return;

      const q = quaternionForFace(placement.face, yawRef.current, yawStepDeg);

      const anchor = {
        kind: mode,
        cell: placement.cell,
        face: placement.face,
        yaw: yawRef.current,
        quat: [q.x, q.y, q.z, q.w],
        createdAtMs: Date.now(),
      };

      occ.set(anchor);
      setAnchors(occ.all());

      bus.emit({
        channel: 'PLACEMENT',
        type: 'ANCHOR_COMMIT',
        payload: {
          kind: anchor.kind,
          cell: { i: anchor.cell[0], j: anchor.cell[1], k: anchor.cell[2] },
          face: anchor.face,
          accepted: true,
          reason: null,
          quaternion: anchor.quat,
        },
      });
    };

    globalThis.addEventListener('keydown', onKeyDown);
    el.addEventListener('pointerdown', onClick);

    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('pointerdown', onClick);
    };
  }, [gl.domElement, mode, occ, yawStepDeg]);

  return (
    <group>
      {anchors.map((a) => {
        const faceCenter = anchorToWorld(a.cell, a.face, cubeSize);

        if (a.kind === 'tile') {
          const h = cubeSize * 0.1;
          return (
            <Tile
              key={`tile-${a.cell[0]}-${a.cell[1]}-${a.cell[2]}-${a.face}`}
              cubeSize={cubeSize}
              yaw={a.yaw}
              position={[faceCenter.x, faceCenter.y + h * 0.5, faceCenter.z]}
            />
          );
        }

        if (a.kind === 'tree') {
          return (
            <Tree
              key={`tree-${a.cell[0]}-${a.cell[1]}-${a.cell[2]}-${a.face}`}
              cubeSize={cubeSize}
              yaw={a.yaw}
              position={[faceCenter.x, faceCenter.y, faceCenter.z]}
            />
          );
        }

        return (
          <PropBox
            key={`prop-${a.cell[0]}-${a.cell[1]}-${a.cell[2]}-${a.face}`}
            cubeSize={cubeSize}
            position={[faceCenter.x, faceCenter.y, faceCenter.z]}
            quaternion={
              Array.isArray(a.quat) && a.quat.length === 4
                ? new THREE.Quaternion(a.quat[0], a.quat[1], a.quat[2], a.quat[3])
                : quaternionForFace(a.face, a.yaw, yawStepDeg)
            }
          />
        );
      })}

      {ghost && (
        <mesh position={ghost.position}>
          <boxGeometry args={[cubeSize, cubeSize * 0.12, cubeSize]} />
          <meshStandardMaterial
            transparent
            opacity={0.35}
            roughness={1}
            color={ghost.ok ? '#ffffff' : '#ff3333'}
          />
        </mesh>
      )}
    </group>
  );
}

PlacementSystem.propTypes = {
  cubeSize: PropTypes.number,
  mode: PropTypes.oneOf(['tile', 'tree', 'prop']),
  yawStepDeg: PropTypes.number,
};
