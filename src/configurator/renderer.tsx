'use client';
// =============================================================
// RENDER 3D — Part[] → mesh Three.js.
// Ánh sáng 3 điểm lấy từ tylko-demo/index.html (dòng 457–471).
// =============================================================
import type {} from '@react-three/fiber'; // nạp kiểu JSX cho <mesh>, <light>...
import { resolveMaterial } from './materials';
import type { Part } from './types';

/** Vẽ 1 Part thành 1 hình hộp 3D. */
export function PartMesh({ part }: { part: Part }) {
  const m = resolveMaterial(part.material);
  return (
    <mesh position={part.position} castShadow receiveShadow>
      <boxGeometry args={part.size} />
      <meshStandardMaterial
        color={m.hex}
        metalness={m.metalness ?? 0}
        roughness={m.roughness ?? 0.6}
        transparent={m.transparent ?? false}
        opacity={m.opacity ?? 1}
      />
    </mesh>
  );
}

/** Ánh sáng 3 điểm — cường độ/vị trí lấy từ tylko-demo. */
export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <hemisphereLight color="#ffffff" groundColor="#c9b89a" intensity={0.6} />
      <directionalLight
        position={[2500, 4500, 3500]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-normalBias={4}
        shadow-camera-left={-3500}
        shadow-camera-right={3500}
        shadow-camera-top={3500}
        shadow-camera-bottom={-1000}
        shadow-camera-near={1000}
        shadow-camera-far={12000}
      />
      <directionalLight position={[-3500, 2000, 1500]} intensity={0.5} />
    </>
  );
}

/** Sàn nhận bóng đổ (mặt phẳng nằm ngang ở y = 0). */
export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial color="#e8e8e8" roughness={0.9} />
    </mesh>
  );
}
