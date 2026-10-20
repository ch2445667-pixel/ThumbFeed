import type { MetadataRoute } from 'next';

/**
 * Lighthouse reported /robots.txt as missing. There is nothing private to hide
 * -- every page is a public gallery -- so allow everything and point crawlers
 * at the app root.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  };
}
