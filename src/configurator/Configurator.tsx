'use client';
// =============================================================
// CONFIGURATOR — khung Canvas 3D dùng chung cho mọi sản phẩm.
// Session 1: chỉ nhận sẵn Part[] và render.
// Session 2: sẽ thêm thanh trượt + giá + cut-list từ ProductDNA.
// =============================================================
import type {} from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import { Ground, PartMesh, SceneLighting } from './renderer';
import type { Part } from './types';

// three 0.184 bỏ PCFSoftShadowMap (mặc định của R3F khi shadows=true).
// Truyền dạng object để R3F set thẳng PCFShadowMap → hết warning deprecation.
const SHADOW_CONFIG = { enabled: true, type: PCFShadowMap };

export function Configurator({ parts }: { parts: Part[] }) {
  return (
    <Canvas
      shadows={SHADOW_CONFIG}
      camera={{ position: [3000, 1900, 3800], fov: 35, near: 100, far: 30000 }}
    >
      <color attach="background" args={['#eeeeee']} />
      <SceneLighting />
      <Ground />
      <group>
        {parts.map((part) => (
          <PartMesh key={part.id} part={part} />
        ))}
      </group>
      <OrbitControls
        target={[0, 900, 0]}
        enableDamping
        maxPolarAngle={Math.PI / 2.05}
        minDistance={1500}
        maxDistance={12000}
      />
    </Canvas>
  );
}
