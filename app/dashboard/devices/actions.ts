'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addDeviceAction(formData: FormData) {
  const supabase = await createClient();
  const serialNumber = formData.get('serialNumber') as string;
  const label = formData.get('label') as string;
  const ipAddress = formData.get('ipAddress') as string || null;

  if (!serialNumber) {
    return { error: 'Device Serial Number is required.' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Not authenticated. Please log in.' };
    }

    // Resolve the active school ID using the security definer RPC function
    const { data: schoolId, error: schoolErr } = await supabase.rpc('auth_school_id');
    if (schoolErr || !schoolId) {
      console.error('Failed to resolve school ID via auth_school_id:', schoolErr);
      return { error: 'School context could not be resolved.' };
    }

    // Insert device record
    const { error: insertErr } = await supabase
      .from('devices')
      .insert({
        school_id: schoolId,
        serial_number: serialNumber.trim().toUpperCase(),
        label: label ? label.trim() : 'Biometric Terminal',
        ip_address: ipAddress ? ipAddress.trim() : null,
        is_active: true,
        firmware_version: 'v8.0.2',
        last_seen_at: new Date().toISOString()
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return { error: `Device Serial Number "${serialNumber}" is already registered. Serials must be unique.` };
      }
      return { error: insertErr.message };
    }

    revalidatePath('/dashboard/devices');
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || 'An unexpected error occurred.' };
  }
}
