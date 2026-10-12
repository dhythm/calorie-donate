import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@calorie-donate/api'],
  // PGlite ships WASM and data files that must load from node_modules.
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
};
export default config;
