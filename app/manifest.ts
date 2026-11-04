import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ES Genech · U11 Foot à 8',
    short_name: 'ESG U11',
    description: 'Application de gestion des effectifs, convocations et matchs de l’ES Genech U11',
    start_url: '/',
    display: 'standalone',
    background_color: '#172554',
    theme_color: '#172554',
    icons: [
      {
        src: '/favicon.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/images/logo-esg.png',
        sizes: '100x100',
        type: 'image/png',
      },
    ],
  }
}

