export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/acesso-restrito', '/api/'],
      },
    ],
  };
}
