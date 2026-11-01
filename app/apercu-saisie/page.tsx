import { notFound } from 'next/navigation'
import { SaisiePreview } from '@/components/saisie-preview'

export const metadata = {
  title: 'Aperçu des saisies · ES Genech U11',
  robots: { index: false, follow: false },
}

export default function SaisiePreviewPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <SaisiePreview />
}
