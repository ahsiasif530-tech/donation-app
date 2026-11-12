export function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// One colour per person, given in a fixed order (the order their first page
// was made), so a person keeps the same colour in avatars and charts. These
// are the validated categorical slots for a dark surface, in slot order.
export const PERSON_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export function personColor(name, order) {
  const i = order.indexOf(name)
  return i >= 0 && i < PERSON_COLORS.length ? PERSON_COLORS[i] : '#6B7280'
}

// A steady colour from the name itself, for places without a person order.
export function avatarColor(name) {
  let hash = 0
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash} 70% 68%)`
}
