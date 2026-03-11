-- Migration 030: Triggers + JWT Custom Claims Hook
-- Phase 1 of multi-tenant migration
--
-- Creates:
-- 1. JWT custom claims hook (injects org_id, role, profile_id into JWT)
-- 2. Auth user created trigger (finds invite, creates user_profile)
-- 3. Auth email changed trigger (syncs to user_profiles)
-- 4. Owner deletion trigger (auto-promotes oldest admin)
-- 5. Platform user helper function (for RLS)

-- ============================================
-- 1. JWT CUSTOM CLAIMS HOOK
-- Injects org_id, user_role, profile_id into JWT claims.
-- This enables fast RLS: USING (org_id = (auth.jwt() ->> 'org_id')::UUID)
-- ============================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_profile_id UUID;
BEGIN
  -- Find active user profile for this auth user
  SELECT id, org_id, role
  INTO v_profile_id, v_org_id, v_role
  FROM public.user_profiles
  WHERE auth_user_id = (event->>'user_id')::UUID
    AND is_active = true
  LIMIT 1;

  -- Only inject claims if user profile exists
  IF v_profile_id IS NOT NULL THEN
    event := jsonb_set(event, '{claims,org_id}', to_jsonb(v_org_id::TEXT));
    event := jsonb_set(event, '{claims,user_role}', to_jsonb(v_role));
    event := jsonb_set(event, '{claims,profile_id}', to_jsonb(v_profile_id::TEXT));
  END IF;

  RETURN event;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Supabase Auth hook: injects org_id, user_role, profile_id into JWT claims for fast RLS.';

-- ============================================
-- 2. PLATFORM USER HELPER (for RLS)
-- ============================================

CREATE OR REPLACE FUNCTION auth.is_platform_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.is_platform_user IS
  'Returns true if current auth user is an active platform staff member.';

-- ============================================
-- 3. HANDLE NEW AUTH USER (auto-process invites)
-- Triggered when a new user signs up via Supabase Auth.
-- Finds matching pending invite and creates user_profile.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invite RECORD;
  v_profile_id UUID;
BEGIN
  -- Find pending invite for this email
  SELECT * INTO v_invite
  FROM public.user_invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite IS NOT NULL THEN
    -- Create user profile from invite
    INSERT INTO public.user_profiles (
      org_id, auth_user_id, email, full_name, role
    ) VALUES (
      v_invite.org_id,
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_invite.role
    )
    RETURNING id INTO v_profile_id;

    -- Mark invite as accepted
    UPDATE public.user_invites
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = v_invite.id;

    -- If invited to a team, add membership
    IF v_invite.team_id IS NOT NULL THEN
      INSERT INTO public.team_memberships (team_id, user_id, role)
      VALUES (v_invite.team_id, v_profile_id, 'member');
    END IF;

    -- If role is owner, set organizations.owner_id
    IF v_invite.role = 'owner' THEN
      UPDATE public.organizations
      SET owner_id = v_profile_id
      WHERE id = v_invite.org_id AND owner_id IS NULL;
    END IF;

    -- Revoke all other pending invites for same email+org
    UPDATE public.user_invites
    SET status = 'revoked'
    WHERE org_id = v_invite.org_id
      AND email = NEW.email
      AND status = 'pending'
      AND id != v_invite.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users INSERT
-- Note: This requires Supabase project configuration to allow triggers on auth schema.
-- If auth triggers are not available, this logic moves to the complete-signup Edge Function.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;

COMMENT ON FUNCTION public.handle_new_auth_user IS
  'Auto-processes pending invites when a new user signs up via Supabase Auth.';

-- ============================================
-- 4. SYNC EMAIL CHANGES
-- When auth.users.email changes, sync to user_profiles.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_auth_email_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.user_profiles
    SET email = NEW.email, updated_at = NOW()
    WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_email_changed ON auth.users;
    CREATE TRIGGER on_auth_email_changed
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_auth_email_change();
  END IF;
END $$;

COMMENT ON FUNCTION public.handle_auth_email_change IS
  'Syncs email changes from auth.users to user_profiles.';

-- ============================================
-- 5. OWNER DELETION — Auto-promote oldest admin
-- When a user_profile with role='owner' is deactivated/deleted,
-- auto-promote the oldest active admin in the same org.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_owner_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  v_new_owner_id UUID;
BEGIN
  -- Only trigger when owner is deactivated
  IF OLD.role = 'owner' AND (
    NEW.status IN ('deactivated','deletion_pending','deleted') OR
    NEW.is_active = false
  ) THEN
    -- Find oldest active admin in same org
    SELECT id INTO v_new_owner_id
    FROM public.user_profiles
    WHERE org_id = OLD.org_id
      AND role = 'admin'
      AND is_active = true
      AND id != OLD.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_new_owner_id IS NOT NULL THEN
      -- Promote admin to owner
      UPDATE public.user_profiles
      SET role = 'owner', role_updated_at = NOW()
      WHERE id = v_new_owner_id;

      -- Update org owner_id
      UPDATE public.organizations
      SET owner_id = v_new_owner_id
      WHERE id = OLD.org_id;

      -- Log in audit
      INSERT INTO public.audit_logs (org_id, user_id, action, resource_type, resource_id, old_value, new_value)
      VALUES (
        OLD.org_id, OLD.id, 'owner_auto_promoted', 'user_profile', v_new_owner_id,
        jsonb_build_object('previous_owner', OLD.id),
        jsonb_build_object('new_owner', v_new_owner_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_owner_deactivated
  AFTER UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (OLD.role = 'owner' AND (NEW.status != OLD.status OR NEW.is_active != OLD.is_active))
  EXECUTE FUNCTION public.handle_owner_deactivation();

COMMENT ON FUNCTION public.handle_owner_deactivation IS
  'LGPD compliance: auto-promotes oldest admin when owner is deactivated/deleted.';
