import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Note: Using untyped client for simplicity. Types are defined in database.types.ts
// and used directly in components for type safety.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
