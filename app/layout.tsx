import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { OfflineIndicator } from '@/components/offline-indicator'
import './globals.css'

export const metadata: Metadata = {
  title: 'ES Genech U11 – Effectif',
  description: "Tableau de bord de l'effectif U11 de l'Entente Sportive de Genech",
  generator: 'v0.app',
  appleWebApp: {
    capable: true,
    title: 'ESG - U11',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#172554',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
        <OfflineIndicator />
        <ServiceWorkerRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
