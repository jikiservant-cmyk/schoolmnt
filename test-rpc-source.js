const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);
async function test() {
  const { data, error } = await client.from('pg_proc').select('*').limit(10);
  console.log(error);
}
test();
