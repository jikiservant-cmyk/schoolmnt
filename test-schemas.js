const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const client = createClient(url, key);
async function test() {
  const { data, error } = await client.from('classes').select('*').limit(1);
  console.log('public:', data, error);
  
  const client2 = createClient(url, key, { db: { schema: 'school' } });
  const { data: d2, error: e2 } = await client2.from('classes').select('*').limit(1);
  console.log('school:', d2, e2);
}
test();
