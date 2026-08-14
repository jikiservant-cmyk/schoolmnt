'use server';

import { createClient } from '@/utils/supabase/server';
import { createPublicAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

async function getEffectiveSchoolId(supabase: any, userId: string) {
  try {
    const { data: staffData } = await supabase
      .from('staff_users')
      .select('person_id, people(school_id)')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (staffData?.people?.school_id) {
      return staffData.people.school_id;
    }
  } catch (err) {
    console.error('Error resolving staff_users:', err);
  }

  try {
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (school?.id) {
      return school.id;
    }
  } catch (err) {
    console.error('Error resolving default school:', err);
  }

  return null;
}

export async function getAttendanceData() {
  const supabase = await createClient();
  
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { error: 'Unauthorized' };
  }

  const schoolId = await getEffectiveSchoolId(supabase, userData.user.id);

  // Get attendance logs
  let logs: any[] = [];
  if (schoolId) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, people(full_name, role)')
      .eq('school_id', schoolId)
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      logs = data;
    }
  }

  // Fallback if logs by school_id is empty or schoolId wasn't set
  if (logs.length === 0) {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, people(full_name, role)')
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      logs = data;
    }
  }

  // Fetch school details
  let school: any = null;
  if (schoolId) {
    const { data } = await supabase
      .from('schools')
      .select('id, name, settings')
      .eq('id', schoolId)
      .maybeSingle();

    if (data) {
      school = data;
    }
  }

  if (!school) {
    const { data } = await supabase
      .from('schools')
      .select('id, name, settings')
      .limit(1)
      .maybeSingle();

    if (data) {
      school = data;
    } else {
      school = {
        id: 'default',
        name: 'SmartSkoolz Academy',
        settings: { balance: 150000 }
      };
    }
  }

  // Ensure balance is loaded from public.wallets table for accuracy
  if (school?.id) {
    try {
      const publicAdmin = createPublicAdminClient();
      const { data: wallet } = await publicAdmin
        .from('wallets')
        .select('balance')
        .eq('tenant_id', school.id)
        .maybeSingle();

      if (wallet && wallet.balance !== null && wallet.balance !== undefined) {
        const curSettings = school.settings || {};
        school.settings = { ...curSettings, balance: Number(wallet.balance) };
      }
    } catch (e) {
      console.warn('Notice loading balance from public.wallets:', e);
    }
  }

  return {
    logs: logs || [],
    school
  };
}

export async function topUpBalance(amount: number, phoneNumber: string) {
  const supabase = await createClient();
  const publicAdmin = createPublicAdminClient();
  
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return { error: 'Unauthorized' };
  }

  const schoolId = await getEffectiveSchoolId(supabase, userData.user.id);

  let school: any = null;
  if (schoolId) {
    const { data } = await supabase
      .from('schools')
      .select('id, settings')
      .eq('id', schoolId)
      .maybeSingle();
    school = data;
  }

  if (!school) {
    const { data } = await supabase
      .from('schools')
      .select('id, settings')
      .limit(1)
      .maybeSingle();
    school = data;
  }

  if (!school) {
    return { error: 'No school found to top up balance' };
  }

  // Strict lookup from public.tenants where id = school.id using public admin client (bypasses schema & RLS)
  let tenantCode = "";
  try {
    const { data: tenantData, error: tenantErr } = await publicAdmin
      .from('tenants')
      .select('id, code, name')
      .eq('id', school.id)
      .maybeSingle() as any;

    console.log(`[NaJiki TopUp] public.tenants DB lookup for school.id (${school.id}):`, { tenantData, tenantErr });

    if (tenantData?.code) {
      tenantCode = tenantData.code;
    } else {
      return { 
        error: `Invalid tenant: No record found in public.tenants matching school ID '${school.id}'. Please ensure the school ID exists in public.tenants.` 
      };
    }
  } catch (err) {
    console.error('Error querying public.tenants table:', err);
    return { error: 'Failed to query tenant record from database.' };
  }

  // Ensure row exists in public.wallets for school.id
  let walletId = "";
  try {
    const { data: existingWallet } = await publicAdmin
      .from('wallets')
      .select('id, balance')
      .eq('tenant_id', school.id)
      .maybeSingle();

    if (existingWallet?.id) {
      walletId = existingWallet.id;
    } else {
      const generatedWalletId = crypto.randomUUID();
      const { data: createdWallet, error: walletInsertErr } = await publicAdmin
        .from('wallets')
        .insert({
          id: generatedWalletId,
          tenant_id: school.id,
          balance: school.settings?.balance || 0,
          currency: 'UGX',
          sms_rate: 50
        })
        .select('id')
        .maybeSingle();

      if (createdWallet?.id) {
        walletId = createdWallet.id;
      } else {
        walletId = generatedWalletId;
        console.warn('Wallet creation note:', walletInsertErr);
      }
    }
  } catch (wErr) {
    console.error('Error ensuring public.wallets record:', wErr);
  }

  // Format phone number to standard international format (+256...) if needed
  const formattedPhone = phoneNumber.startsWith('0') ? `+256${phoneNumber.slice(1)}` : phoneNumber;

  // Generate unique idempotency key
  const idempotencyKey = `sch_topup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const najikiDomain = process.env.NAJIKI_DOMAIN || 'api.najiki.com';
  const najikiUrl = najikiDomain.startsWith('http') ? najikiDomain : `https://${najikiDomain}`;
  const apiKey = process.env.NAJIKI_API_KEY || 'test_key';

  const payload = {
    applicationCode: process.env.NAJIKI_APP_CODE || "school",
    paymentTypeCode: "general",
    externalEntityId: school.id,
    amount: amount,
    currency: "UGX",
    phoneNumber: formattedPhone,
    idempotencyKey: idempotencyKey,
    tenantCode: tenantCode,
    metadata: {
      type: "topup",
      schoolId: school.id
    }
  };

  // Write record in public.wallet_transactions
  const transactionId = crypto.randomUUID();
  try {
    await publicAdmin
      .from('wallet_transactions')
      .insert({
        id: transactionId,
        wallet_id: walletId,
        tenant_id: school.id,
        direction: 'credit',
        amount: amount,
        status: 'pending',
        type: 'topup',
        reference: idempotencyKey,
        payment_intent_id: idempotencyKey,
        description: `Top up via NaJiki Mobile Money (${formattedPhone})`,
        currency: 'UGX',
        raw_provider_response: JSON.stringify(payload)
      });
    console.log(`[NaJiki TopUp] Pending record created in public.wallet_transactions: ${transactionId}`);
  } catch (txErr) {
    console.error('Error inserting record into public.wallet_transactions:', txErr);
  }

  console.log('[NaJiki TopUp] Exact Payload sent to NaJiki API:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${najikiUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json().catch(() => ({}));
    console.log('[NaJiki TopUp] Response from NaJiki API:', response.status, resData);

    if (!response.ok) {
      // Update transaction status to failed
      try {
        await publicAdmin
          .from('wallet_transactions')
          .update({
            status: 'failed',
            raw_provider_response: JSON.stringify(resData)
          })
          .eq('id', transactionId);
      } catch (e) {
        console.warn('Error updating transaction failure status:', e);
      }

      return { 
        error: resData.error || resData.message || `NaJiki payment request failed with status ${response.status}` 
      };
    }

    // Update transaction status to processing
    try {
      await publicAdmin
        .from('wallet_transactions')
        .update({
          status: 'processing',
          raw_provider_response: JSON.stringify(resData)
        })
        .eq('id', transactionId);
    } catch (e) {
      console.warn('Error updating transaction processing status:', e);
    }

    return { 
      success: true, 
      pending: true, 
      message: resData.message || 'Payment request sent successfully! Please authorize the prompt on your phone.' 
    };
  } catch (err: any) {
    console.error('NaJiki payment gateway connection error:', err);

    try {
      await publicAdmin
        .from('wallet_transactions')
        .update({
          status: 'failed',
          raw_provider_response: JSON.stringify({ error: err?.message || 'Network error' })
        })
        .eq('id', transactionId);
    } catch (e) {
      console.warn('Error updating transaction failure status:', e);
    }

    return { error: `Failed to communicate with NaJiki payment gateway: ${err?.message || 'Network error'}` };
  }
}

