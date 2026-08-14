-- Add extra columns to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_error TEXT,
  ADD COLUMN IF NOT EXISTS provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Make transaction_ref unique to prevent double credits
ALTER TABLE wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_ref_unique;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_ref_unique UNIQUE (transaction_ref);

-- Update the credit_wallet function
CREATE OR REPLACE FUNCTION credit_wallet(
  p_school_id UUID,
  p_amount NUMERIC,
  p_tx_ref TEXT,
  p_provider TEXT DEFAULT 'najiki'
) RETURNS JSONB AS $$
DECLARE
  v_new_balance NUMERIC;
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO wallet_transactions (school_id, amount, transaction_ref, provider, type)
  VALUES (p_school_id, p_amount, p_tx_ref, p_provider, 'credit')
  ON CONFLICT (transaction_ref) DO NOTHING
  RETURNING true INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'duplicate, skipped');
  END IF;

  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE school_id = p_school_id
  RETURNING balance INTO v_new_balance;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- pg_cron for the retry sweep (This requires pg_cron and pg_net extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- We can't know the specific project URL in advance in this migration, 
-- but users can replace YOUR_PROJECT_REF or it can be set later. 
-- Assuming they set it correctly.
/* 
SELECT cron.schedule(
  'retry-stuck-notifications',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_DISPATCH_SECRET'
    ),
    body := '{"retry_sweep": true}'::jsonb
  );
  $$
);
*/
