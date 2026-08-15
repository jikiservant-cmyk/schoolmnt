import { createAdminClient } from '@/utils/supabase/admin';

// Helper to enqueue a command for all registered devices or a specific SN
// In serverless environments (Vercel), in-memory Maps do not persist across lambda invocations.
// We use the `device_logs` table as a persistent queue for commands by using `device_user_id` = "COMMAND".
export async function enqueueDeviceCommand(cmd: string, targetSn?: string) {
  try {
    const supabase = createAdminClient();
    
    // We store the raw command in the payload JSON and use the `device_logs` table 
    // as a temporary queue so it persists across Serverless Edge Functions
    await supabase.from('device_logs').insert({
      raw_serial_number: targetSn || 'ALL',
      device_user_id: 'COMMAND',
      payload: { cmd },
      event_timestamp: new Date().toISOString(),
      processed: false,
    });
  } catch (error) {
    console.error('Failed to enqueue ADMS command to database:', error);
  }
}
