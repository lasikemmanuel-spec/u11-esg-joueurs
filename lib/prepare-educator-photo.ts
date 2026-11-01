export async function prepareEducatorPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez un fichier image.')
  if (file.size > 12 * 1024 * 1024) throw new Error('La photo doit faire moins de 12 Mo avant compression.')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 320 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Impossible de préparer cette photo.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.68, 0.54, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) throw new Error('Impossible de préparer cette photo.')
      if (blob.size > 30 * 1024) continue
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Impossible de lire cette photo.'))
        reader.onerror = () => reject(new Error('Impossible de lire cette photo.'))
        reader.readAsDataURL(blob)
      })
    }
    throw new Error('Cette photo ne peut pas être compressée sous 30 Ko.')
  } finally {
    image.close()
  }
}
