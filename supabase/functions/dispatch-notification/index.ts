import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const NAJIKI_DOMAIN = Deno.env.get("NAJIKI_DOMAIN") || "https://api.najiki.com";
const NAJIKI_API_KEY = Deno.env.get("NAJIKI_API_KEY") || "";
const DISPATCH_SECRET = Deno.env.get("DISPATCH_SECRET") || "";

// Cost per SMS charged via public.debit_sms_wallet
const SMS_COST = Number(Deno.env.get("SMS_COST") || "1");

const SCHOOL_SCHEMA = "school";
const NOTIFS_TABLE = "notifications";

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractNotificationId(body: any): string | null {
  return (
    body?.notification_id ??
    body?.record?.id ??
    body?.new?.id ??
    body?.record?.notification_id ??
    body?.new?.notification_id ??
    body?.id ??
    null
  )?.toString?.() ?? null;
}

function toE164(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  if (digits.startsWith("254") || digits.startsWith("256")) return "+" + digits;
  return phone.startsWith("+") ? phone : "+" + digits;
}

function toIsoAfterMinutes(mins: number) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

function maxAttemptsReached(nextRetryCount: number) {
  // nextRetryCount is 1..N; cap is 5 total attempts
  return nextRetryCount >= 5;
}

function requireEnv(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  try {
    const dispatchSecret = (Deno.env.get("DISPATCH_SECRET") || "").trim();
    if (dispatchSecret) {
      const xSecret = (req.headers.get("x-dispatch-secret") || req.headers.get("X-Dispatch-Secret") || "").trim().replace(/,+$/, "");
      const authHeader = (req.headers.get("Authorization") || req.headers.get("authorization") || "").trim().replace(/,+$/, "");
      const authBearer = authHeader.replace(/^Bearer\s+/i, "").trim();

      const incomingSecret = xSecret || authBearer || authHeader;

      if (!incomingSecret || incomingSecret !== dispatchSecret) {
        return jsonResponse({ error: "Unauthorized - Invalid or missing DISPATCH_SECRET header" }, 401);
      }
    }

    if (!NAJIKI_API_KEY) {
      throw new Error("NAJIKI_API_KEY is required");
    }

    const body = await req.json().catch(() => ({} as any));

    if (body?.retry_sweep) {
      return await runRetrySweep();
    }

    const notificationId = extractNotificationId(body);
    if (!notificationId) return jsonResponse({ error: "missing notification id" }, 400);

    return await dispatchOne(notificationId);
  } catch (err: any) {
    console.error("dispatch-notification error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

async function dispatchOne(notificationId: string) {
  const lockUntilIso = toIsoAfterMinutes(1);

  // Claim the row without using disallowed status values.
  // We keep status='pending' (DB allows it), but we move next_retry_at forward
  // so other concurrent invocations won't select the same row.
  const { data: claimed, error: claimErr } = await supabase
    .schema(SCHOOL_SCHEMA)
    .from(NOTIFS_TABLE)
    .update({
      next_retry_at: lockUntilIso,
      error: null,
    })
    .eq("id", notificationId)
    .eq("status", "pending")
    .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
    .select(
      "id,status,school_id,recipient_phone_snapshot,message,retry_count,next_retry_at"
    )
    .maybeSingle();

  if (claimErr) {
    console.error("claim error:", claimErr);
    return jsonResponse({ error: "claim failed" }, 500);
  }

  if (!claimed) {
    // Someone else is already handling it (or it's not claimable yet)
    const { data: current } = await supabase
      .schema(SCHOOL_SCHEMA)
      .from(NOTIFS_TABLE)
      .select("status,next_retry_at")
      .eq("id", notificationId)
      .maybeSingle();

    if (!current) return jsonResponse({ error: "notification not found" }, 404);

    return jsonResponse(
      { skipped: true, reason: `not claimable (status=${(current as any).status})` },
      200
    );
  }

  const notif = claimed as any;
  const nextRetryCount = (notif.retry_count ?? 0) + 1;
  const isFinalAttempt = maxAttemptsReached(nextRetryCount);

  const phone = toE164(notif.recipient_phone_snapshot || "");
  if (!phone) {
    await supabase
      .schema(SCHOOL_SCHEMA)
      .from(NOTIFS_TABLE)
      .update({
        status: "failed",
        error: "invalid_phone_snapshot",
        retry_count: nextRetryCount,
        next_retry_at: null,
      })
      .eq("id", notificationId);

    return jsonResponse({ error: "invalid phone" }, 200);
  }

  const schoolIdText = String(notif.school_id);

  const { data: wallet, error: walletErr } = await supabase
    .from("wallets")
    .select("id,balance")
    .eq("tenant_id", schoolIdText)
    .maybeSingle();

  if (walletErr) {
    await markDispatchFailed(notificationId, nextRetryCount, isFinalAttempt, "wallet_lookup_error");
    return jsonResponse({ error: "wallet lookup failed" }, 200);
  }

  if (!wallet) {
    await markDispatchFailed(notificationId, nextRetryCount, isFinalAttempt, "wallet_missing");
    return jsonResponse({ error: "wallet missing" }, 200);
  }

  const idempotencyKey = `sms:${notificationId}`;

  // debit_sms_wallet returns SETOF wallets and raises exceptions on failure.
  const { error: debitErr } = await supabase.rpc("debit_sms_wallet", {
    p_wallet_id: wallet.id,
    p_amount: SMS_COST,
    p_idempotency_key: idempotencyKey,
    p_tenant_id: schoolIdText,
    p_description: `notification_dispatch:${notificationId}`,
  });

  if (debitErr) {
    await supabase
      .schema(SCHOOL_SCHEMA)
      .from(NOTIFS_TABLE)
      .update({
        status: isFinalAttempt ? "failed" : "pending",
        error: "insufficient_balance_or_debit_failed",
        retry_count: nextRetryCount,
        next_retry_at: isFinalAttempt ? null : toIsoAfterMinutes(3),
        provider_response: JSON.stringify({ debit: debitErr.message }),
      })
      .eq("id", notificationId);

    return jsonResponse({ error: "insufficient balance" }, 200);
  }

  // Call Najiki with timeout
  const najikiTimeoutMs = Number(Deno.env.get("NAJIKI_TIMEOUT_MS") || "30000");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), najikiTimeoutMs);

  let najikiRes: Response | null = null;
  let najikiData: any = {};

  try {
    najikiRes = await fetch(`${NAJIKI_DOMAIN}/api/messaging/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NAJIKI_API_KEY}`,
      },
      body: JSON.stringify({
        smsId: notif.id,
        to: phone,
        message: notif.message,
      }),
      signal: controller.signal,
    });

    najikiData = await najikiRes.json().catch(() => ({}));
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `timeout_${najikiTimeoutMs}ms` : String(e);

    await supabase
      .schema(SCHOOL_SCHEMA)
      .from(NOTIFS_TABLE)
      .update({
        status: isFinalAttempt ? "failed" : "pending",
        retry_count: nextRetryCount,
        provider_response: JSON.stringify({ error: msg }),
        error: "provider_timeout_or_fetch_error",
        next_retry_at: isFinalAttempt ? null : toIsoAfterMinutes(3),
      })
      .eq("id", notificationId);

    return jsonResponse({ success: false, error: msg }, 200);
  } finally {
    clearTimeout(timeout);
  }

  if (najikiRes && najikiRes.ok) {
    await supabase
      .schema(SCHOOL_SCHEMA)
      .from(NOTIFS_TABLE)
      .update({
        status: "sent",
        provider_response: JSON.stringify(najikiData),
        error: null,
        sent_at: new Date().toISOString(),
        next_retry_at: null,
      })
      .eq("id", notificationId);

    return jsonResponse({ success: true }, 200);
  }

  await supabase
    .schema(SCHOOL_SCHEMA)
    .from(NOTIFS_TABLE)
    .update({
      status: isFinalAttempt ? "failed" : "pending",
      retry_count: nextRetryCount,
      provider_response: JSON.stringify(najikiData),
      error: "provider_failed",
      next_retry_at: isFinalAttempt ? null : toIsoAfterMinutes(3),
    })
    .eq("id", notificationId);

  return jsonResponse({ success: false, error: najikiData }, 200);
}

async function markDispatchFailed(
  notificationId: string,
  nextRetryCount: number,
  isFinalAttempt: boolean,
  errCode: string
) {
  await supabase
    .schema(SCHOOL_SCHEMA)
    .from(NOTIFS_TABLE)
    .update({
      status: isFinalAttempt ? "failed" : "pending",
      error: errCode,
      retry_count: nextRetryCount,
      next_retry_at: isFinalAttempt ? null : toIsoAfterMinutes(3),
    })
    .eq("id", notificationId);
}

async function runRetrySweep() {
  const nowIso = new Date().toISOString();

  const { data: stuck, error } = await supabase
    .schema(SCHOOL_SCHEMA)
    .from(NOTIFS_TABLE)
    .select("id")
    .eq("status", "pending")
    .lt("retry_count", 5)
    // Include NULLs so brand-new rows can be rescued
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(50);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (!stuck || stuck.length === 0) return jsonResponse({ swept: 0 }, 200);

  for (const row of stuck) {
    await dispatchOne(String((row as any).id));
  }

  return jsonResponse({ swept: stuck.length }, 200);
}
