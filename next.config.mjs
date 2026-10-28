import withPWAInit from "@ducanh2912/next-pwa";

const revision = Date.now().toString();

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  fallbacks: { document: "/offline" },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // App-shell routes that must open offline even if never visited.
    additionalManifestEntries: ["/", "/note", "/community", "/shared", "/offline"].map((url) => ({ url, revision })),
    // transformers.js + its WASM runtime (20+ MB) exceed Workbox's 2 MB precache limit, so cache them on first use instead.
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/vendor/transformers/"),
        handler: "CacheFirst",
        options: { cacheName: "transformers-runtime", expiration: { maxEntries: 10 } },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: Azure Static Web Apps (Free) serves plain files; the app is fully client-side.
  output: "export",
  images: { unoptimized: true },
};

export default withPWA(nextConfig);
