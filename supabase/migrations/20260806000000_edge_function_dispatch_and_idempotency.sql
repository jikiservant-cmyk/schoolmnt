-- Migration for Edge Function Dispatcher Setup, Unique Constraint, & pg_cron Retry Sweep

-- 1. Ensure columns exist on notifications table for provider feedback & retries
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_error TEXT,
  ADD COLUMN IF NOT EXISTS provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- 2. Add unique constraint on wallet_transactions reference for strict idempotency
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_ref_unique'
    ) THEN
        ALTER TABLE public.wallet_transactions
        ADD CONSTRAINT wallet_transactions_ref_unique UNIQUE (reference);
    END IF;
END $$;

-- 3. Atomic credit_wallet RPC function with ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.credit_wallet(
    p_tenant_id TEXT,
    p_amount NUMERIC,
    p_reference TEXT DEFAULT NULL,
    p_provider_response TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id TEXT;
    v_new_balance NUMERIC;
    v_inserted BOOLEAN := false;
BEGIN
    -- 1. Ensure a wallet row exists for the tenant
    INSERT INTO public.wallets (id, tenant_id, balance, currency)
    VALUES (gen_random_uuid()::text, p_tenant_id, 0, 'UGX')
    ON CONFLICT (tenant_id) DO NOTHING;

    -- 2. Fetch and lock wallet row
    SELECT id, balance INTO v_wallet_id, v_new_balance
    FROM public.wallets
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    -- 3. Try inserting or updating transaction row atomically with ON CONFLICT
    IF p_reference IS NOT NULL THEN
        INSERT INTO public.wallet_transactions (
            id, wallet_id, tenant_id, direction, amount, status, reference, raw_provider_response
        )
        VALUES (
            gen_random_uuid()::text, v_wallet_id, p_tenant_id, 'credit', p_amount, 'success', p_reference, p_provider_response
        )
        ON CONFLICT (reference) DO NOTHING
        RETURNING true INTO v_inserted;

        -- If duplicate reference found and skipped, return duplicate notice
        IF v_inserted IS NOT TRUE THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'duplicate transaction, skipped',
                'wallet_id', v_wallet_id,
                'new_balance', v_new_balance
            );
        END IF;
    END IF;

    -- 4. Increment balance atomically
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- 5. Sync balance to schools.settings for UI compatibility
    UPDATE public.schools
    SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{balance}',
        to_jsonb(v_new_balance)
    )
    WHERE id::text = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- 4. Enable extensions & schedule pg_cron retry sweep (run only if pg_cron is supported in destination)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron job to invoke dispatch-notification retry_sweep every 3 minutes
-- Note: Replace YOUR_SUPABASE_PROJECT_REF and YOUR_DISPATCH_SECRET when running manually if needed
/*
SELECT cron.schedule(
    'retry-stuck-notifications',
    '*/3 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/dispatch-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_DISPATCH_SECRET"}'::jsonb,
        body := '{"retry_sweep": true}'::jsonb
    );
    $$
);
*/
