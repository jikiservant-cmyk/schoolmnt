import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Use this strictly on the server for service-role actions, bypassing RLS
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

  return createSupabaseClient<Database>(
    url,
    key,
    {
      db: { schema: 'school' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

// Targeting the default 'public' schema
export function createPublicAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'

  return createSupabaseClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
