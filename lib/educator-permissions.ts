export type EducatorRole = 'educator' | 'admin' | 'reader'

export function hasEducatorAccess(educator: { role: EducatorRole }) {
  return educator.role === 'educator' || educator.role === 'admin'
}
