import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('preferredLanguage')?.value || 'en';
  const validLocales = ['en', 'fr', 'es', 'pt', 'it'];
  const safeLocale = validLocales.includes(locale) ? locale : 'en';

  return {
    locale: safeLocale,
    messages: (await import(`../messages/${safeLocale}.json`)).default
  };
});
