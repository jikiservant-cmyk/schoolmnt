'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export async function addPersonAction(formData: FormData) {
  const supabase = await createClient();
  const fullName = formData.get('fullName') as string;
  const role = formData.get('role') as 'student' | 'teacher';
  
  if (!fullName || !role) {
    return { error: 'Full Name and Role are required.' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Not authenticated. Please log in.' };
    }

    // Build params dynamically based on selected role
    let params: Record<string, any> = {
      p_role: role,
      p_full_name: fullName.trim(),
    };

    // 1. Handle Biometric Hardware Device User ID (from ZKTeco machine enrollment)
    const deviceUserId = formData.get('deviceUserId') as string;

    if (deviceUserId && deviceUserId.trim()) {
      params.p_device_user_id = deviceUserId.trim();
    } else {
      params.p_device_user_id = null;
    }

    let generatedTeacherPin: string | null = null;

    if (role === 'student') {
      const classId = formData.get('classId') as string;
      if (!classId) {
        return { error: 'Please select a class for the student.' };
      }
      params.p_class_id = classId;

      const guardianName = formData.get('guardianName') as string;
      const guardianPhone = formData.get('guardianPhone') as string;
      const guardianRelationship = formData.get('guardianRelationship') as string || 'guardian';

      if (guardianName && guardianName.trim()) {
        params.p_guardian_full_name = guardianName.trim();
      }
      if (guardianPhone && guardianPhone.trim()) {
        params.p_guardian_phone = guardianPhone.trim();
      }
      params.p_guardian_relationship = guardianRelationship.trim();

    } else if (role === 'teacher') {
      const phone = formData.get('phone') as string;
      
      // Get array of selected class IDs
      const classIdsJson = formData.get('classIdsJson') as string;
      let classIds: string[] = [];
      if (classIdsJson) {
        try {
          classIds = JSON.parse(classIdsJson);
        } catch (e) {
          console.error('Failed to parse classIds:', e);
        }
      }

      if (phone && phone.trim()) {
        params.p_phone = phone.trim();
      } else {
        params.p_phone = null;
      }

      // 2. Auto-generate a globally unique Teacher Attendance Passcode / PIN (alphanumeric, e.g. T7K9M2)
      const adminClient = createAdminClient();
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      
      // Fetch existing teacher pin hashes to guarantee 100% uniqueness
      const { data: existingStaff } = await adminClient
        .from('staff_users')
        .select('pin_hash')
        .not('pin_hash', 'is', null);

      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 50) {
        attempts++;
        let candidate = 'T';
        for (let i = 0; i < 5; i++) {
          candidate += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        let collision = false;
        if (existingStaff && existingStaff.length > 0) {
          for (const su of existingStaff) {
            if (su.pin_hash && bcrypt.compareSync(candidate, su.pin_hash)) {
              collision = true;
              break;
            }
          }
        }
        if (!collision) {
          generatedTeacherPin = candidate;
          isUnique = true;
        }
      }

      params.p_pin = generatedTeacherPin;
      params.p_class_ids = classIds.length > 0 ? classIds : null;
      params.p_issue_manual_link = true;
    } else {
      return { error: 'Invalid role selection.' };
    }

    // Invoke the RPC function school.fn_add_person
    const { data, error } = await (supabase as any).rpc('fn_add_person', params);

    if (error) {
      console.error('Error executing fn_add_person:', error);
      
      const errMsg = error.message || '';
      if (errMsg.includes('not_authenticated_staff')) {
        return { error: 'You need to be logged in as a school staff/admin to perform this action.' };
      }
      if (errMsg.includes('not_authorized')) {
        return { error: 'Only school administrators can register new members.' };
      }
      if (errMsg.includes('invalid_role_use_student_or_teacher')) {
        return { error: 'Role selection must be either Student or Teacher.' };
      }
      if (errMsg.includes('student_requires_class_id')) {
        return { error: 'A student registration requires a valid class assignment.' };
      }
      if (errMsg.includes('invalid_class_for_school')) {
        return { error: 'The chosen class assignment does not belong to your school.' };
      }
      if (errMsg.includes('invalid_pin_format')) {
        return { error: 'The teacher PIN format was rejected by database.' };
      }
      if (error.code === '23505') {
        return { error: 'The biometric Enrollment ID is already registered to another person in your school.' };
      }

      return { error: error.message || 'The registry transaction failed in the database.' };
    }

    // If a biometric device user ID was provided, automatically enqueue a DATA USER push to the ZKTeco terminal
    if (params.p_device_user_id) {
      try {
        let className = '';
        if (role === 'student' && params.p_class_id) {
          const { data: cls } = await supabase
            .from('classes')
            .select('name')
            .eq('id', params.p_class_id)
            .maybeSingle();
          if (cls?.name) className = cls.name;
        }

        const { formatZKTecoDisplayName } = await import('@/utils/zkteco/formatter');
        const { enqueueDeviceCommand } = await import('@/utils/zkteco/commandQueue');

        const displayName = formatZKTecoDisplayName({
          full_name: fullName.trim(),
          role: role,
          classes: className ? { name: className } : null
        });

        enqueueDeviceCommand(`DATA UPDATE userinfo PIN=${params.p_device_user_id}\tName=${displayName}\tPri=0`);
      } catch (cmdErr) {
        console.warn('Non-blocking: Failed to enqueue ADMS user sync command:', cmdErr);
      }
    }

    revalidatePath('/dashboard/people');
    return { 
      success: true,
      data,
      teacherPin: generatedTeacherPin
    };
  } catch (err: any) {
    console.error('addPersonAction server error:', err);
    return { error: err?.message || 'An unexpected error occurred.' };
  }
}

export async function resetTeacherPinAction(personId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated. Please log in.' };
  }

  try {
    // 1. Verify target person is a teacher
    const { data: person, error: pErr } = await supabase
      .from('people')
      .select('id, full_name, role')
      .eq('id', personId)
      .single();

    if (pErr || !person || person.role !== 'teacher') {
      return { error: 'Teacher record not found.' };
    }

    // 2. Auto-generate a unique 6-character PIN (e.g. T7K9M2)
    const adminClient = createAdminClient();
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    const { data: existingStaff } = await adminClient
      .from('staff_users')
      .select('pin_hash')
      .not('pin_hash', 'is', null);

    let isUnique = false;
    let attempts = 0;
    let newPin = '';

    while (!isUnique && attempts < 50) {
      attempts++;
      let candidate = 'T';
      for (let i = 0; i < 5; i++) {
        candidate += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      let collision = false;
      if (existingStaff && existingStaff.length > 0) {
        for (const su of existingStaff) {
          if (su.pin_hash && bcrypt.compareSync(candidate, su.pin_hash)) {
            collision = true;
            break;
          }
        }
      }
      if (!collision) {
        newPin = candidate;
        isUnique = true;
      }
    }

    if (!newPin) {
      return { error: 'Failed to generate a unique PIN. Please try again.' };
    }

    // 3. Hash the new PIN using bcrypt with salt rounds = 6
    const salt = bcrypt.genSaltSync(6);
    const pinHash = bcrypt.hashSync(newPin, salt);

    // 4. Update staff_users table for this teacher
    const { error: updateErr } = await adminClient
      .from('staff_users')
      .update({
        pin_hash: pinHash,
        pin_failed_attempts: 0,
        pin_locked_until: null,
      })
      .eq('person_id', personId);

    if (updateErr) {
      console.error('Error resetting teacher PIN:', updateErr);
      return { error: 'Failed to update passcode in database.' };
    }

    revalidatePath('/dashboard/people');
    return {
      success: true,
      newPin,
      teacherName: person.full_name,
    };
  } catch (err: any) {
    console.error('resetTeacherPinAction server error:', err);
    return { error: err?.message || 'An unexpected error occurred.' };
  }
}

