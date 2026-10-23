'use server'

import { updateTag } from 'next/cache'

export async function refreshSheetData() {
  updateTag('google-sheet')
}
