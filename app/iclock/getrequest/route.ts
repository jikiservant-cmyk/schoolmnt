import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Device polling for server commands
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sn = searchParams.get('SN');
  
  if (sn) {
    const supabase = createAdminClient();
    await supabase
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('serial_number', sn);
  }

  // Return OK indicating no pending commands
  // Once remote enrollment is implemented, commands like "C:1:DATA UPDATE userinfo PIN=10001" will be returned here
  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}
