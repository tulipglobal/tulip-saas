import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://sealayer.io'
  const now = new Date()

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/verify`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/donors`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
