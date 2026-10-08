"use client";

import dynamic from "next/dynamic";

// WebGL only exists in the browser, so skip server rendering for the 3D scene.
// `ssr: false` is only allowed inside a Client Component, hence this small wrapper.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default Scene;
