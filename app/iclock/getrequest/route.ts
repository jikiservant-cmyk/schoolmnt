import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { pendingDeviceCommands } from '@/utils/zkteco/commandQueue';

// Device polling for server commands (ADMS /iclock/getrequest)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sn = searchParams.get('SN');
  
  if (!sn) {
    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  const supabase = createAdminClient();

  // 1. Update device heartbeat
  await supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('serial_number', sn);

  // 2. Check if we have queued in-memory commands for this terminal
  const deviceQueue = pendingDeviceCommands.get(sn) || [];
  const broadcastQueue = pendingDeviceCommands.get('ALL') || [];
  const combinedQueue = [...deviceQueue, ...broadcastQueue];

  if (combinedQueue.length > 0) {
    // Send up to 10 commands per poll
    const batch = combinedQueue.splice(0, 10);
    pendingDeviceCommands.set(sn, deviceQueue.filter(c => !batch.some(b => b.id === c.id)));
    pendingDeviceCommands.set('ALL', broadcastQueue.filter(c => !batch.some(b => b.id === c.id)));

    const responseBody = batch.map(b => b.cmd).join('\n');
    console.log(`[ZKTeco ADMS] Sending ${batch.length} commands to SN ${sn}:\n${responseBody}`);
    
    return new NextResponse(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}
