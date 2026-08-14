-- ============================================================
-- Migration: Bootstrap enums + default admin account
-- Created: 2026-07-21
-- Purpose:
--   1. Ensure ALL base enums/tables/functions exist (safe to run on
--      a fresh Supabase project where prior migrations were not applied).
--   2. Create a default admin account:
--        Email:    admin
--        Password: admin123
--      (Uses admin@ejari.local as the email because Supabase requires email form.)
--   3. Add missing "branch" column on bank_accounts (used by tenant pay UI).
-- Safe: uses IF NOT EXISTS / DO blocks everywhere — re-runnable.
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS (for pwd encryption)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 2. BASE ENUMS (create if missing)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'accountant', 'data_entry', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meter_category AS ENUM ('electricity', 'water');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM ('active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'check', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new payment methods (idempotent)
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'deposit';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cheque';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- Extended enums used by comprehensive fix
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_type AS ENUM ('shop', 'apartment', 'office', 'warehouse', 'land', 'clinic', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.unit_status AS ENUM ('available', 'rented', 'reserved', 'maintenance', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_request_status AS ENUM ('pending_review', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add 'draft' and 'renewed' to contract_status (idempotent)
DO $$ BEGIN ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'draft';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'renewed';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ============================================================
-- 3. HELPER FUNCTION set_updated_at (used by many triggers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- 4. ADD branch column to bank_accounts (idempotent)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS branch TEXT;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ============================================================
-- 5. DEFAULT ADMIN ACCOUNT: admin / admin123
--    Email stored as "admin@ejari.local"; user logs in by typing
--    "admin" in the email field if they want, but we also provide
--    a hint in the login UI with the full credentials.
-- ============================================================
DO $$
DECLARE
  v_uid UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- Only create if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ejari.local') THEN
    v_encrypted_pw := crypt('admin123', gen_salt('bf', 10));

    -- Minimal safe insert (only set fields we need; everything else uses DEFAULTS
    -- to avoid generated-column / schema-mismatch errors across Supabase versions).
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_anonymous
    ) VALUES (
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@ejari.local',
      v_encrypted_pw,
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "مدير النظام"}'::jsonb,
      now(), now(),
      false
    ) RETURNING id INTO v_uid;

    -- Create profile
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (v_uid, 'مدير النظام', NULL);

    -- Grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin');
  END IF;
END $$;
