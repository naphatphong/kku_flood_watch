"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

// Fixed full-screen canvas behind the HTML. M1 shows a placeholder cylinder;
// the real can replaces it in M2.
export default function Scene() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 6], fov: 35 }} dpr={[1, 2]}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <mesh>
          <cylinderGeometry args={[0.6, 0.6, 3, 48]} />
          <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.25} />
        </mesh>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}
