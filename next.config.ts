import type { NextConfig } from 'next';

const config: NextConfig = {
  agentRules: false, // don't write editor helper files into the project root
  // Open Graph images read these font files at runtime.
  outputFileTracingIncludes: { '/**': ['./assets/fonts/**'] },
};

export default config;
