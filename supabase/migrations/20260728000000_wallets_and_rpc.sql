-- Migration to create wallets, wallet_transactions, and atomic credit_wallet RPC function

CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'UGX',
    sms_rate NUMERIC DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    wallet_id TEXT NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
    type TEXT,
    reference TEXT,
    description TEXT,
    note TEXT,
    currency TEXT DEFAULT 'UGX',
    raw_provider_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atomic RPC function to credit tenant wallet
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

    -- 3. Increment balance atomically
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;

    -- 4. Update matching transaction status to 'success'
    IF p_reference IS NOT NULL THEN
        UPDATE public.wallet_transactions
        SET status = 'success',
            raw_provider_response = COALESCE(p_provider_response, raw_provider_response),
            updated_at = NOW()
        WHERE reference = p_reference OR (tenant_id = p_tenant_id AND reference = p_reference AND status = 'pending');
    END IF;

    -- 5. Sync balance to schools.settings for UI compatibility
    UPDATE public.schools
    SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{balance}',
        to_jsonb(v_new_balance)
    )
    WHERE id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet_id,
        'new_balance', v_new_balance
    );
END;
$$;
