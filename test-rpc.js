const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const client = createClient(url, key, { db: { schema: 'school' } });
async function test() {
  const { data, error } = await client.rpc('fn_add_person', {
    p_role: 'teacher',
    p_full_name: 'Test Teacher'
  });
  console.log(data, error);
}
test();
