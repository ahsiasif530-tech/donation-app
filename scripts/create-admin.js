// Usage: node --env-file=.env.local scripts/create-admin.js <email> <password> "<Full Name>"
import { createClient } from '@supabase/supabase-js'

const [email, password, fullName] = process.argv.slice(2)

if (!email || !password || !fullName) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.js <email> <password> "<Full Name>"')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.error('Failed to create user:', error.message)
  process.exit(1)
}

const { error: profileError } = await supabase.from('profiles').insert({
  id: data.user.id,
  full_name: fullName,
  role: 'admin',
})

if (profileError) {
  console.error('User created, but profile insert failed:', profileError.message)
  process.exit(1)
}

console.log(`Admin created: ${email} (id: ${data.user.id})`)
