import 'server-only'
import tls from 'node:tls'
import crypto from 'node:crypto'

// Sends one email through Gmail's SMTP server with an App Password. Kept to
// the few SMTP commands a plain send needs, so no mail library is required.
const HOST = 'smtp.gmail.com'
const PORT = 465
const TIMEOUT_MS = 15000

const base64 = (text) => Buffer.from(text, 'utf8').toString('base64')
// Wrapped at 76 characters, as MIME expects; base64 lines never start with a
// dot, so the body needs no SMTP dot-stuffing.
const base64Body = (text) => base64(text).replace(/.{76}/g, '$&\r\n')
const encodedWord = (text) => `=?UTF-8?B?${base64(text)}?=`

function buildMessage({ from, fromName, to, subject, text, html }) {
  const boundary = `b_${crypto.randomBytes(12).toString('hex')}`
  return [
    `From: ${encodedWord(fromName)} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodedWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(html),
    `--${boundary}--`,
  ].join('\r\n')
}

export async function sendGmail({ user, appPassword, fromName, to, subject, text, html }) {
  // Addresses go straight into SMTP commands and headers.
  if (!/^[^\s<>,@]+@[^\s<>,@]+\.[^\s<>,@]+$/.test(to)) throw new Error(`Invalid recipient: ${to}`)

  const socket = tls.connect({ host: HOST, port: PORT, servername: HOST })
  socket.setEncoding('utf8')
  socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('Gmail SMTP timed out')))

  // Each server reply (possibly several "250-" lines ending in "250 ") is
  // queued until the next read() takes it.
  const replies = []
  const lines = []
  let buffer = ''
  let pending = null
  let failure = null

  const deliver = () => {
    if (!pending) return
    if (replies.length) {
      pending.resolve(replies.shift())
      pending = null
    } else if (failure) {
      pending.reject(failure)
      pending = null
    }
  }

  socket.on('data', (chunk) => {
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      lines.push(line)
      if (/^\d{3}(?!-)/.test(line)) replies.push(lines.splice(0).join('\n'))
    }
    deliver()
  })
  socket.on('error', (err) => {
    failure = err
    deliver()
  })
  socket.on('close', () => {
    failure ||= new Error('Gmail SMTP connection closed')
    deliver()
  })

  const read = () => new Promise((resolve, reject) => {
    pending = { resolve, reject }
    deliver()
  })

  async function command(line, expectedCode) {
    if (line !== null) socket.write(`${line}\r\n`)
    const reply = await read()
    if (!reply.startsWith(String(expectedCode))) throw new Error(`Gmail SMTP: ${reply}`)
  }

  try {
    await command(null, 220)
    await command('EHLO localhost', 250)
    await command(`AUTH PLAIN ${base64(`\0${user}\0${appPassword.replace(/\s/g, '')}`)}`, 235)
    await command(`MAIL FROM:<${user}>`, 250)
    await command(`RCPT TO:<${to}>`, 250)
    await command('DATA', 354)
    await command(`${buildMessage({ from: user, fromName, to, subject, text, html })}\r\n.`, 250)
    socket.end('QUIT\r\n')
  } catch (err) {
    socket.destroy()
    throw err
  }
}
