import type { NextConfig } from "next";
import withPWA from "next-pwa";
const defaultRuntimeCaching = require("next-pwa/cache");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
  basePath: '',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default withPWA({
  dest: "public",
  sw: "sw-custom.js", // CRITICAL: instructs next-pwa to output the file the app actually registers
  register: false, // Vamos registrar manualmente via useRegisterSW para evitar conflitos e erros de window
  skipWaiting: true,
  disable: false, 
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  buildExcludes: [
    /middleware-manifest\.json$/,
    /_next\/static\/.*manifest\.json$/,
    /app-build-manifest\.json$/
  ],
  runtimeCaching: [
    {
      urlPattern: /\/api\/real-time\/stream/,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/api\/auth\/.*/,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/login($|\?)/,
      handler: 'NetworkOnly', // Crucial para evitar cache da página de login e loops
    },
    ...defaultRuntimeCaching,
  ]
})(nextConfig);
