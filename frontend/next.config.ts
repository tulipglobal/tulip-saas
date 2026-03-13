const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  customWorkerSrc: 'worker',
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: '/offline',
  },
  extendDefaultRuntimeCaching: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.tulipds\.com\/api\/(projects|budgets|expenses|categories).*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
}

module.exports = withPWA(nextConfig)
