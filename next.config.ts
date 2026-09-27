import type { NextConfig } from 'next';

const config: NextConfig = {
  // Open Graph images read these font files at runtime.
  outputFileTracingIncludes: { '/**': ['./assets/fonts/**'] },
};

export default config;
