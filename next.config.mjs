/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: [] },
  compress: true,
  images: {
    domains: [],
  },
  async headers() {
    return [
      // Allow Meta's webhook verification (GET) and event delivery (POST)
      // without CORS errors. Signature verification via WHATSAPP_APP_SECRET
      // is the security mechanism — do NOT add session/cookie auth here.
      // NOTE: The POST handler must read the raw body with `await req.text()`
      // then JSON.parse() so the x-hub-signature-256 HMAC can be verified over
      // the exact bytes Meta signed, before any further parsing.
      {
        source: '/api/whatsapp/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
