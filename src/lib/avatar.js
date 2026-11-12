export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// A steady colour per person, so the same name always gets the same avatar.
export function avatarColor(name) {
  let hash = 0
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash} 70% 68%)`
}
