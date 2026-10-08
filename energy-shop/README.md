# VOLTRA — 3D energy drink landing page

Concept project — not a real product. Portfolio piece: Next.js + TypeScript + React Three Fiber.
Full plan and milestones: [PLAN.md](./PLAN.md).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also generates route types for tsc)
npm run lint
```

## Structure

- `app/page.tsx` — page sections (HTML on top of the 3D canvas)
- `components/three/Scene.tsx` — full-screen fixed `<Canvas>` behind the page
- `components/three/SceneLoader.tsx` — loads the scene in the browser only (`ssr: false`)
- `config/brand.ts` — brand name and tagline; change them here only

This app lives in the `energy-shop/` folder of the KKU Flood Watch repo for now.
On Vercel, set **Root Directory** to `energy-shop`.
