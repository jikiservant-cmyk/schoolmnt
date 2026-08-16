'use server';

import { createAdminClient, createPublicAdminClient } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';

export async function verifyTeacherPin(classId: string, pin: string) {
  const adminClient = createAdminClient();
  const cleanPin = pin.trim().toUpperCase();

  // 1. Fetch class to get school_id
  const { data: cls, error: clsError } = await adminClient
    .from('classes')
    .select('id, school_id')
    .eq('id', classId)
    .maybeSingle();

  if (clsError || !cls) {
    console.error('verifyTeacherPin class fetch error:', clsError, 'classId:', classId);
    return { success: false, error: 'Class not found.' };
  }

  // 2. Fetch active teachers in this school
  const { data: teachers, error: tError } = await adminClient
    .from('people')
    .select('id, full_name, role, school_id, device_user_id')
    .eq('school_id', cls.school_id)
    .eq('role', 'teacher')
    .eq('is_active', true);

  if (tError || !teachers || teachers.length === 0) {
    return { success: false, error: 'No active teachers found for this school.' };
  }

  // 3. Fetch staff_users pin_hash records for these teachers
  const teacherIds = teachers.map(t => t.id);
  const { data: staffUsers } = await adminClient
    .from('staff_users')
    .select('id, person_id, pin_hash')
    .in('person_id', teacherIds);

  let matchedTeacher = null;

  if (staffUsers && staffUsers.length > 0) {
    for (const su of staffUsers) {
      if (su.pin_hash) {
        const isMatch = bcrypt.compareSync(cleanPin, su.pin_hash) || bcrypt.compareSync(pin.trim(), su.pin_hash);
        if (isMatch) {
          matchedTeacher = teachers.find(t => t.id === su.person_id);
          break;
        }
      }
    }
  }

  // Fallback check: if device_user_id (ZKTeco numeric ID) matches directly
  if (!matchedTeacher) {
    matchedTeacher = teachers.find(t => 
      t.device_user_id && (t.device_user_id.trim() === pin.trim() || t.device_user_id.trim().toUpperCase() === cleanPin)
    );
  }

  if (!matchedTeacher) {
    return { success: false, error: 'Invalid Teacher Attendance PIN / Passcode.' };
  }

  return { success: true, teacher: matchedTeacher };
}

export async function getStudentsForClass(classId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('people')
    .select('id, full_name, device_user_id')
    .eq('class_id', classId)
    .eq('role', 'student')
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    return { error: 'Failed to fetch students.' };
  }

  return { students: data || [] };
}


export async function submitClassAttendance(
  classId: string,
  teacherId: string,
  presentStudentIds: string[],
  absentStudentIds: string[],
  attendanceType: 'check_in' | 'check_out' = 'check_in'
) {
  const adminClient = createAdminClient();

  // Get class and school info
  const { data: cls } = await adminClient
    .from('classes')
    .select('id, name, school_id')
    .eq('id', classId)
    .maybeSingle();

  if (!cls) return { success: false, error: 'Class not found' };
  
  // Resolve staff_users.id for marked_by FK constraint
  let markedByStaffUserId: string | null = null;
  if (teacherId) {
    const { data: staffUser } = await adminClient
      .from('staff_users')
      .select('id')
      .or(`id.eq.${teacherId},person_id.eq.${teacherId}`)
      .maybeSingle();

    if (staffUser) {
      markedByStaffUserId = staffUser.id;
    }
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Check today's existing attendance logs for these students
  let eligibleStudentIds = presentStudentIds;
  if (presentStudentIds.length > 0) {
    const { data: existingLogs } = await adminClient
      .from('attendance_logs')
      .select('person_id, attendance_type')
      .in('person_id', presentStudentIds)
      .gte('occurred_at', startOfDay.toISOString())
      .lte('occurred_at', endOfDay.toISOString());

    const alreadyRecordedSet = new Set(
      (existingLogs || [])
        .filter(l => l.attendance_type === attendanceType)
        .map(l => l.person_id)
    );

    eligibleStudentIds = presentStudentIds.filter(id => !alreadyRecordedSet.has(id));
  }

  if (presentStudentIds.length > 0 && eligibleStudentIds.length === 0) {
    return {
      success: true,
      skipped: true,
      message: `Selected student(s) already have a ${attendanceType === 'check_in' ? 'check-in' : 'check-out'} record for today.`
    };
  }
  
  const presentLogs = eligibleStudentIds.map(studentId => ({
    id: crypto.randomUUID(),
    school_id: cls.school_id,
    person_id: studentId,
    class_id_at_time: cls.id,
    class_name_at_time: cls.name,
    status: 'present' as const,
    attendance_type: attendanceType,
    marked_by: markedByStaffUserId,
    occurred_at: now.toISOString(),
    source: 'manual' as const,
    created_at: now.toISOString(),
  }));

  if (presentLogs.length > 0) {
    const { error: insertError } = await adminClient
      .from('attendance_logs')
      .insert(presentLogs);
      
    if (insertError) {
      console.error("Error inserting manual attendance", insertError);
      return { success: false, error: 'Failed to save attendance records.' };
    }
  }

  // --- SEND SMS TO PARENTS ---
  if (eligibleStudentIds.length > 0) {
    try {
      // 1. Fetch Students
      const { data: studentsData } = await adminClient
        .from('people')
        .select('id, full_name')
        .in('id', eligibleStudentIds);
        
      // 2. Fetch Parents (prefer primary contact, fallback to any linked parent with phone)
      const { data: parentsData } = await adminClient
        .from('student_parents')
        .select('student_id, parent_id, is_primary_contact, parents(phone, full_name)')
        .in('student_id', eligibleStudentIds);

      if (studentsData && parentsData && parentsData.length > 0) {
        // Map of studentId -> { parentId, parentName, phone, is_primary_contact }
        const notificationsToSend: any[] = [];
        const studentMap = new Map(studentsData.map(s => [s.id, s.full_name]));
        
        const parentByStudent = new Map<string, any>();
        for (const sp of parentsData) {
          const phone = (sp.parents as any)?.phone;
          if (!phone) continue;
          
          const existing = parentByStudent.get(sp.student_id);
          if (!existing || (!existing.is_primary_contact && sp.is_primary_contact)) {
            parentByStudent.set(sp.student_id, {
              parentId: sp.parent_id,
              parentName: (sp.parents as any)?.full_name,
              phone: phone,
              is_primary_contact: sp.is_primary_contact
            });
          }
        }
        
        for (const [sId, sName] of studentMap.entries()) {
          const pInfo = parentByStudent.get(sId);
          if (pInfo) {
            notificationsToSend.push({
              studentId: sId,
              parentId: pInfo.parentId,
              studentName: sName,
              parentName: pInfo.parentName,
              phone: pInfo.phone
            });
          }
        }
        

                        if (notificationsToSend.length > 0) {
          const timestampStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
          });

          for (const notif of notificationsToSend) {
            let smsMessageText = `Dear Parent,`;
            if (attendanceType === 'check_in') {
              smsMessageText += ` your child ${notif.studentName} checked IN at school successfully at ${timestampStr}.`;
            } else {
              smsMessageText += ` your child ${notif.studentName} checked OUT of school and is heading home at ${timestampStr}.`;
            }

            // Queue the notification in school.notifications
            // The Supabase Edge Function will handle wallet deduction and Najiki dispatch
            await adminClient
              .from('notifications')
              .insert({
                school_id: cls.school_id,
                recipient_type: 'parent',
                recipient_id: notif.parentId,
                recipient_phone_snapshot: notif.phone,
                channel: 'sms',
                notification_type: 'attendance',
                status: 'pending',
                message: smsMessageText
              });
          }
        }
      }
    } catch (e) {
      console.error('Failed to send class attendance SMS messages', e);
    }
  }
  
  return { success: true, count: presentLogs.length };
}

