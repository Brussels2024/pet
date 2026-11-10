const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');

export default function sitemap() {
  if (!siteUrl) return [];

  return [
    {
      url: siteUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
