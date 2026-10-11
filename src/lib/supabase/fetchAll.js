// Supabase returns at most 1000 rows per request and silently drops the rest,
// so lists that can grow past that are read in pages. `query` builds a fresh
// query each time and must be ordered on a unique key (e.g. created_at then
// id) so pages don't overlap. Resolves to { data, error } like a single query.
const PAGE_SIZE = 1000

export async function fetchAll(query) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
