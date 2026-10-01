// Cookie holding the admin's switched-off invoice boxes (gateway keys and
// 'withdrawals', comma-separated), read by the server to render only the rest.
export const HIDDEN_SECTIONS_COOKIE = 'admin_hidden_sections'

export function parseHiddenSections(cookieStore) {
  const value = cookieStore.get(HIDDEN_SECTIONS_COOKIE)?.value
  return value ? value.split(',').filter(Boolean) : []
}
