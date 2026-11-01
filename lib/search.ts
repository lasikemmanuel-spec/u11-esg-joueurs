function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
}

export function matchesSearch(query: string, values: readonly string[]) {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const searchable = normalizeSearch(values.join(' '))
  return terms.every((term) => searchable.includes(term))
}
