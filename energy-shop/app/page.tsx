import SceneLoader from "@/components/three/SceneLoader";
import { brand } from "@/config/brand";

export default function Home() {
  return (
    <>
      <SceneLoader />
      <main className="pointer-events-none flex min-h-dvh flex-col items-center justify-between px-4 py-16 text-center">
        <h1 className="text-6xl font-black tracking-tighter sm:text-8xl">{brand.name}</h1>
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">{brand.tagline}</p>
      </main>
      <footer className="py-6 text-center text-xs text-white/40">
        Concept project — not a real product.
      </footer>
    </>
  );
}
