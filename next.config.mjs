/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Anti-clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Anti-MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactiver caméra/micro/géoloc
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // HSTS (force HTTPS pour 2 ans)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts : Next.js inline nécessite unsafe-inline en dev, en prod on utilise nonce si besoin
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              // Styles : Tailwind génère des styles inline
              "style-src 'self' 'unsafe-inline'",
              // Images : logo local + data URIs
              "img-src 'self' data: blob:",
              // Fonts : polices locales uniquement
              "font-src 'self'",
              // Connexions API : Google Sheets + Vercel analytics + soi-même
              "connect-src 'self' https://sheets.googleapis.com https://oauth2.googleapis.com https://va.vercel-scripts.com",
              // Pas de frames
              "frame-src 'none'",
              // Pas d'objets Flash etc.
              "object-src 'none'",
              // Base URI restreinte
              "base-uri 'none'",
              // Form action restreinte
              "form-action 'self'",
              // Interdire l’intégration de l’application dans une frame
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          // Désactiver le cache sur les pages sensibles (overridé par les routes API)
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ]
  },
}

export default nextConfig
