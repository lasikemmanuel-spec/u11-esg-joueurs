function normalizedEducatorTokens(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function normalizeEducatorName(name: string) {
  return normalizedEducatorTokens(name).sort().join(' ')
}

export function sameEducatorName(first: string, second: string) {
  const normalizedFirst = normalizeEducatorName(first)
  return normalizedFirst !== '' && normalizedFirst === normalizeEducatorName(second)
}

export function hasEducatorSurname(name: string, surname: string) {
  const nameTokens = normalizedEducatorTokens(name)
  const surnameTokens = normalizedEducatorTokens(surname)
  return surnameTokens.length === 1 && nameTokens.at(-1) === surnameTokens[0]
}
