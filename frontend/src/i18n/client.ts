'use client';

export const locales = ['en', 'fr', 'es', 'pt', 'it'] as const;
export type Locale = (typeof locales)[number];
