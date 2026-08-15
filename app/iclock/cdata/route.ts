import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// 1. Initial Handshake / Config Pull from Device
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sn = searchParams.get('SN');
  
  console.log(`[ZKTeco ADMS] Init GET request from SN: ${sn}`);
  console.log(`[ZKTeco ADMS] Query Params:`, Object.fromEntries(searchParams.entries()));

  if (sn) {
    const supabase = createAdminClient();
    // Verify device exists in our registry and update heartbeat
    const { data: device } = await supabase
      .from('devices')
      .select('id')
      .eq('serial_number', sn)
      .maybeSingle();
      
    if (device) {
      await supabase
        .from('devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', device.id);
    } else {
      console.warn(`[ZKTeco ADMS] Unrecognized device SN: ${sn}. Please add it to the portal.`);
    }
  }

  // The device expects a specific text configuration response to know the server is ready.
  // Standard ADMS parameters for F18 and similar legacy devices.
  const responseText = `GET OPTION FROM: ${sn}\nStamp=9999\nOpStamp=9999\nErrorDelay=60\nDelay=10\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111000000\nTimeZone=180\nRealtime=1\nEncrypt=0`;
  
  return new NextResponse(responseText, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// 2. Data Push (Attendance Logs, Users, etc.)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sn = searchParams.get('SN');
  const table = searchParams.get('table'); // e.g. ATTLOG

  const rawBody = await req.text();
  console.log(`[ZKTeco ADMS] POST request from SN: ${sn}, Table: ${table}`);
  console.log(`[ZKTeco ADMS] Payload:\n${rawBody}`);

  const supabase = createAdminClient();

  let device: { id: string; school_id: string } | null = null;

  if (sn) {
     const { data } = await supabase
        .from('devices')
        .select('id, school_id')
        .eq('serial_number', sn)
        .maybeSingle();
     
     device = data as any;

     if (device) {
       await supabase
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', device.id);
     }
  }

  // If this is an attendance log push
  if (table === 'ATTLOG' && sn) {
    if (!device) {
      console.warn(`[ZKTeco ADMS] Received ATTLOG for unknown device SN: ${sn}`);
      // Acknowledge anyway so the device doesn't hang/infinitely retry
      return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // Usually lines are formatted as TSV:
    // User_PIN    Date_Time       Status  Verify_Type     Work_Code
    // e.g., 10001  2023-10-12 08:00:00     0       1       0
    const lines = rawBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const pin = parts[0];
        const datetimeStr = parts[1]; // Device's local time YYYY-MM-DD HH:MM:SS
        
        // Find user by device_user_id (PIN) mapped to this specific school
        const { data: person } = await supabase
          .from('people')
          .select('id')
          .eq('school_id', device.school_id)
          .eq('device_user_id', pin)
          .maybeSingle();
          
        if (person) {
           let isoString;
           try {
             isoString = new Date(datetimeStr).toISOString();
           } catch (e) {
             isoString = new Date().toISOString();
           }

           // Check for duplicates (idempotency)
           const { data: existingLog } = await supabase
             .from('attendance_logs')
             .select('id')
             .eq('person_id', (person as any).id)
             .eq('occurred_at', isoString)
             .maybeSingle();
             
           if (!existingLog) {
             const statusNum = parts[2] || '0';
             const attendanceType: 'check_in' | 'check_out' = statusNum === '0' ? 'check_in' : 'check_out';

             await supabase.from('attendance_logs').insert({
               school_id: device.school_id,
               person_id: (person as any).id,
               device_id: device.id,
               occurred_at: isoString,
               attendance_type: attendanceType,
               status: 'present',
               source: 'device'
             });
             console.log(`[ZKTeco ADMS] Logged attendance for PIN ${pin} at ${datetimeStr}`);
           } else {
             console.log(`[ZKTeco ADMS] Duplicate attendance ignored for PIN ${pin} at ${datetimeStr}`);
           }
        } else {
           console.warn(`[ZKTeco ADMS] Unrecognized PIN ${pin} for school ${device.school_id}`);
        }
      }
    }
  }

  // Acknowledge receipt to clear the transactions from the device queue
  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}
