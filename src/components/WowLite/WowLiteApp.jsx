import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { AIBrain } from '../../ai/brain.js';
import { createPhysicsAdapter } from '../../physics/adapter.js';
import { v3copy } from '../../physics/math.js';

// Ported utility functions from the original demo
const lakeCenterX = 50;
const lakeCenterY = 50;
const lakeRadius = 30;

function getTerrainHeight(x, z) {
  let y = Math.sin(x * 0.05) * 2 + Math.cos(z * 0.05) * 2;
  y += Math.sin(x * 0.1 + z * 0.2) * 1;
  const dist = Math.hypot(x - lakeCenterX, z - lakeCenterY);
  if (dist < lakeRadius) y -= Math.cos(((dist / lakeRadius) * Math.PI) / 2) * 8;
  return y;
}

function TerrainSurface({ size = 200, step = 2 }) {
  const meshRef = useRef();

  const geometry = useMemo(() => {
    const half = size / 2;
    const seg = Math.max(2, Math.floor(size / step));
    const vertsPerSide = seg + 1;
    const positions = new Float32Array(vertsPerSide * vertsPerSide * 3);

    let i = 0;
    for (let iz = 0; iz <= seg; iz++) {
      const z = -half + (iz / seg) * size;
      for (let ix = 0; ix <= seg; ix++) {
        const x = -half + (ix / seg) * size;
        const y = getTerrainHeight(x, z);
        positions[i++] = x;
        positions[i++] = y;
        positions[i++] = z;
      }
    }

    const indices = [];
    for (let iz = 0; iz < seg; iz++) {
      for (let ix = 0; ix < seg; ix++) {
        const a = iz * vertsPerSide + ix;
        const b = a + 1;
        const c = (iz + 1) * vertsPerSide + ix;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [size, step]);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.95 }),
    [],
  );

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry = geometry;
      meshRef.current.material = material;
      meshRef.current.receiveShadow = true;
    }

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <mesh ref={meshRef} />;
}

TerrainSurface.propTypes = {
  size: PropTypes.number,
  step: PropTypes.number,
};

function EnemyMesh({ entity }) {
  const ref = useRef();
  useFrame(() => {
    if (!entity.transform) return;
    const p = entity.transform.position;
    if (ref.current) ref.current.position.set(p.x, p.y, p.z);
  });
  return (
    <mesh ref={ref}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color={0xff0000} />
    </mesh>
  );
}

EnemyMesh.propTypes = {
  entity: PropTypes.shape({
    transform: PropTypes.shape({
      position: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        z: PropTypes.number,
      }),
      rotationY: PropTypes.number,
    }),
  }).isRequired,
};

function PlayerMesh({ entity }) {
  const ref = useRef();
  useFrame(() => {
    if (!entity.transform) return;
    const p = entity.transform.position;
    if (ref.current) {
      ref.current.position.set(p.x, p.y + 0.25, p.z);
      ref.current.rotation.y = entity.transform.rotationY || 0;
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <capsuleGeometry args={[0.5, 1, 4, 16]} />
        <meshStandardMaterial color={0x0000ff} />
      </mesh>
    </group>
  );
}

PlayerMesh.propTypes = {
  entity: PropTypes.shape({
    transform: PropTypes.shape({
      position: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        z: PropTypes.number,
      }),
      rotationY: PropTypes.number,
    }),
  }).isRequired,
};

function applyPlayerInput(adapter, ents, keys, moveSpeed, jumpSpeed) {
  const playerEnt = ents.get('player');
  if (!playerEnt || !playerEnt.transform) return;

  const body = adapter.world.bodies.get('player');
  if (!body) return;

  const move = { x: 0, z: 0 };
  if (keys.w) move.z -= 1;
  if (keys.s) move.z += 1;
  if (keys.a) move.x -= 1;
  if (keys.d) move.x += 1;

  const len = Math.hypot(move.x, move.z);
  if (len > 1) {
    move.x /= len;
    move.z /= len;
  }

  const yaw = playerEnt.transform.rotationY || 0;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const wx = move.x * cos + move.z * sin;
  const wz = -move.x * sin + move.z * cos;

  body.velocity.x = wx * moveSpeed;
  body.velocity.z = wz * moveSpeed;

  const groundH = getTerrainHeight(body.position.x, body.position.z);
  const onGround = body.position.y <= groundH + 0.6;
  if (keys.Space && onGround) body.velocity.y = jumpSpeed;
}

function applyTerrainBarrier(adapter, ents) {
  for (const [id, body] of adapter.world.bodies.entries()) {
    const r =
      body && body.shape && body.shape.type === 'SPHERE' && typeof body.shape.radius === 'number'
        ? body.shape.radius
        : 0.5;
    const groundH = getTerrainHeight(body.position.x, body.position.z);
    const minY = groundH + r;
    if (body.position.y < minY) {
      body.position.y = minY;
      if (body.velocity && body.velocity.y < 0) body.velocity.y = 0;
    }
    const ent = ents.get(id);
    if (ent && ent.transform) ent.transform.position = v3copy(body.position);
  }
}

export default function WowLiteApp() {
  const FIXED_DT = 1 / 60;
  const MAX_STEPS = 5;

  const adapterRef = useRef(null);
  const entitiesRef = useRef(new Map());
  const accRef = useRef(0);
  const lastTimeRef = useRef(performance.now() / 1000);

  // Game-tuned constants (tunable via UI)
  const [moveSpeed, setMoveSpeed] = useState(6);
  const [gravity, setGravity] = useState(-20);
  const jumpSpeed = 8;

  const keysRef = useRef({ w: false, a: false, s: false, d: false, Space: false });

  useEffect(() => {
    const adapter = createPhysicsAdapter();
    adapter.initialize({ gravity: { x: 0, y: gravity, z: 0 } });
    adapterRef.current = adapter;

    // Create ECS entities map
    const ents = entitiesRef.current;

    // Player
    ents.set('player', {
      id: 'player',
      name: 'Player',
      transform: { position: v3copy({ x: 0, y: getTerrainHeight(0, 0) + 1, z: 0 }), rotationY: 0 },
      physics: { mass: 1, is_kinematic: false, shape: { type: 'SPHERE', radius: 0.5 } },
      stats: { hp: 100, maxHp: 100, mana: 100, maxMana: 100 },
    });

    // Enemies
    for (let i = 0; i < 10; i++) {
      let ex = (Math.random() - 0.5) * 100;
      let ez = (Math.random() - 0.5) * 100;
      if (getTerrainHeight(ex, ez) < -2) {
        ex += 50;
      }
      const id = `enemy-${i}`;
      ents.set(id, {
        id,
        name: `Angry Cube ${i + 1}`,
        transform: { position: v3copy({ x: ex, y: getTerrainHeight(ex, ez) + 0.75, z: ez }) },
        physics: { mass: 1, is_kinematic: false, shape: { type: 'SPHERE', radius: 0.75 } },
        stats: { hp: 100, maxHp: 100 },
      });
    }

    // Add to physics world
    adapter.syncAddEntities(ents);

    // Register with the brain minimally
    try {
      const brain = new AIBrain();
      brain.registerApplication({ name: 'wow-lite', entities: ents });
      // Keep brain on window for debugging
      globalThis.__AIBRAIN = brain;
    } catch (e) {
      // Non-fatal: WoW-Lite should still run without AI brain.
      console.warn('WowLite: AIBrain init failed', e && e.message);
    }

    // Keyboard handlers
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') keysRef.current.Space = true;
      if (Object.hasOwn(keysRef.current, k)) keysRef.current[k] = true;
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') keysRef.current.Space = false;
      if (Object.hasOwn(keysRef.current, k)) keysRef.current[k] = false;
    };
    globalThis.addEventListener('keydown', down);
    globalThis.addEventListener('keyup', up);

    return () => {
      globalThis.removeEventListener('keydown', down);
      globalThis.removeEventListener('keyup', up);
      adapter.shutdown();
    };
  }, []);

  // Update gravity setting on adapter when GRAVITY changes
  useEffect(() => {
    if (adapterRef.current) adapterRef.current.world.settings.gravity = { x: 0, y: gravity, z: 0 };
  }, [gravity]);

  // Physics loop via RAF with fixed substeps
  useEffect(() => {
    let rafId = null;

    function loop(nowMs) {
      const now = nowMs / 1000;
      let frameTime = Math.min(now - lastTimeRef.current, 0.25);
      lastTimeRef.current = now;
      accRef.current += frameTime;
      let steps = 0;
      while (accRef.current >= FIXED_DT && steps < MAX_STEPS) {
        physicsStep(FIXED_DT);
        accRef.current -= FIXED_DT;
        steps++;
      }
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);

    function physicsStep(dt) {
      const adapter = adapterRef.current;
      const ents = entitiesRef.current;
      if (!adapter) return;

      applyPlayerInput(adapter, ents, keysRef.current, moveSpeed, jumpSpeed);

      // Step physics and writeback
      adapter.stepAndWriteBack(entitiesRef.current, dt);

      // Collision barrier: prevent any body from falling below the terrain surface.
      // (PhysicsWorld currently has no static colliders, so we enforce a ground constraint here.)
      applyTerrainBarrier(adapter, ents);
    }
  }, [moveSpeed, gravity, jumpSpeed]);

  // For camera follow compute render target position from player
  const player = entitiesRef.current.get('player');

  return (
    <div className="wow-lite-root" style={{ width: '100%', height: '720px', position: 'relative' }}>
      <Canvas shadows camera={{ position: [0, 2, 8], fov: 60 }}>
        {/* react-three-fiber uses non-DOM JSX props; disable DOM-only linting for these nodes. */}
        {/* eslint-disable react/no-unknown-property */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/* eslint-enable react/no-unknown-property */}

        {/* Ground (matches getTerrainHeight) */}
        <TerrainSurface size={200} step={2} />

        {/* Enemies */}
        {Array.from(entitiesRef.current.values())
          .filter((e) => e.id !== 'player')
          .map((ent) => (
            <EnemyMesh key={ent.id} entity={ent} />
          ))}

        {/* Player */}
        {player && <PlayerMesh entity={player} />}

        <OrbitControls enablePan={false} enableZoom={true} />
      </Canvas>

      {/* HUD overlays */}
      <div style={{ position: 'absolute', left: 12, top: 12, width: 260 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#4a9eff 0%,#2a5298 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🧙‍♂️
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#ffd700' }}>Player</div>
            <div style={{ fontSize: 12, color: '#bcd' }}>Level 60 Mage</div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 4 }}>
            <div
              style={{
                height: 12,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(player?.stats.hp / player?.stats.maxHp) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg,#990000 0%,#ff3333 100%)',
                }}
              />
            </div>
            <div style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              {player?.stats.hp} / {player?.stats.maxHp}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12 }}>Move Speed</div>
              <input
                type="range"
                min="1"
                max="12"
                step="0.1"
                value={moveSpeed}
                onChange={(e) => setMoveSpeed(Number(e.target.value))}
              />
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Gravity</div>
              <input
                type="range"
                min="-40"
                max="-5"
                step="0.1"
                value={gravity}
                onChange={(e) => setGravity(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Minimap */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          width: 180,
          height: 180,
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#000',
          border: '3px solid #ffd700',
        }}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '12px solid #ffd700',
            }}
          />
        </div>
      </div>
    </div>
  );
}
