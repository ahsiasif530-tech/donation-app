// Shown the moment an admin link is clicked, while the server loads the data.
export default function AdminLoading() {
  const block = { background: 'var(--a-surface-2)' }

  return (
    <main className="admin-theme min-h-screen px-4 py-10" aria-busy="true">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <p className="a-brand a-gold-text">BlessedHands</p>
        <div className="h-8 w-64 rounded-lg" style={block} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="a-card h-40" />
          <div className="a-card h-40 sm:col-span-2" />
        </div>
        <div className="a-card h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="a-card h-72" />
          <div className="a-card h-72" />
        </div>
        <p className="sr-only">Loading…</p>
      </div>
    </main>
  )
}
