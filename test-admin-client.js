const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const client = createClient(url, key);
async function test() {
  const { data, error } = await client.from('classes').select('*').limit(1);
  console.log(data, error);
}
test();
