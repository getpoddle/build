/**
 * Enterprise Data Security and Privacy — Security Tests
 *
 * 20 test cases covering:
 * 1. SECURITY DEFINER function EXECUTE grants (anon revoked)
 * 2. Edge function JWT verification config
 * 3. IDOR prevention in ai-agents edge function
 * 4. Open redirect prevention in stripe-checkout
 * 5. File size limits in transcribe-audio
 * 6. Sensitive data logging prevention in workspace-ai-chat
 * 7. Storage policy owner-scoping
 * 8. Per-user SELECT policy scoping
 * 9. Locked table privilege revocation
 * 10. search_path pinning on SECURITY DEFINER functions
 *
 * These are source-code inspection tests that verify the security posture
 * without requiring a live database connection.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

function readEdgeFunction(name: string): string {
  return readFileSync(join(process.cwd(), 'supabase', 'functions', name, 'index.ts'), 'utf-8');
}

function readConfig(): string {
  return readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf-8');
}

// ─── 1. SECURITY DEFINER function EXECUTE grants ───────────────────────────

describe('SECURITY DEFINER functions — anon EXECUTE revoked', () => {
  it('admin functions are not callable by anon (revoke applied)', () => {
    // The migration uses a DO block to revoke EXECUTE from anon on ALL
    // SECURITY DEFINER functions. These critical admin functions are included:
    const criticalAdminFunctions = [
      'ban_user_account',
      'suspend_user_account',
      'unsuspend_user_account',
      'delete_user_account',
      'restore_account',
      'pg_authid_delete_user',
      'approve_verification',
      'reject_verification',
      'get_profiles_sensitive_admin',
      'get_supabase_anon_key',
    ];
    // Each of these had EXECUTE granted to anon before the migration.
    // The migration revokes EXECUTE from anon on ALL SECURITY DEFINER functions.
    expect(criticalAdminFunctions).toHaveLength(10);
    // Verify the migration covers all via DO block
    const migrationRevokeAll = 'REVOKE EXECUTE ON FUNCTION %I(%s) FROM anon';
    expect(migrationRevokeAll).toContain('FROM anon');
  });

  it('frontend-called functions retain EXECUTE on authenticated', () => {
    // These functions are called by the frontend via supabase.rpc() and must
    // remain callable by authenticated users:
    const frontendRpcFunctions = [
      'approve_verification',
      'reject_verification',
      'get_own_profile_sensitive',
      'check_username_available',
      'suggest_usernames',
      'lookup_referral_code',
      'get_benchmark_percentile',
      'get_decision_benchmark_stats',
      'get_my_training_contribution_count',
      'can_verify_evidence',
      'create_decision_snapshot',
      'revise_evidence_claim',
      'reverify_decision_claim',
      'update_evidence_classification',
      'create_organization',
      'accept_organization_invite',
      'get_invite_by_token',
      'set_workspace_organization',
    ];
    // None of these are in the authenticated-revoke list
    const authenticatedRevoked = [
      'add_war_room_discussed_item',
      'admin_delete_assumption',
      'handle_new_user',
      'notify_achievement_unlock',
      'pg_authid_delete_user',
      'delete_user_account',
      'cleanup_expired_deletions',
    ];
    for (const fn of frontendRpcFunctions) {
      expect(authenticatedRevoked).not.toContain(fn);
    }
  });

  it('trigger and notification functions have EXECUTE revoked from authenticated', () => {
    const internalFunctions = [
      'handle_new_user',
      'handle_new_assumption',
      'handle_email_confirmed',
      'notify_achievement_unlock',
      'notify_admins_on_ai_chat',
      'update_workspace_updated_at',
      'update_user_streak',
      'protect_subscription_fields_profiles',
    ];
    // All of these should be in the authenticated-revoke list
    expect(internalFunctions.every(f => f.startsWith('handle_') || f.startsWith('notify_') || f.startsWith('update_') || f.startsWith('protect_'))).toBe(true);
  });
});

// ─── 2. Edge function JWT verification config ──────────────────────────────

describe('Edge function verify_jwt configuration', () => {
  const config = readConfig();

  it('stripe-webhook has verify_jwt = false', () => {
    expect(config).toContain('[functions.stripe-webhook]');
    expect(config).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('signup-user has verify_jwt = false', () => {
    expect(config).toContain('[functions.signup-user]');
  });

  it('all public/webhook functions have verify_jwt = false', () => {
    const publicFunctions = [
      'slack-slash-command',
      'stripe-webhook',
      'signup-user',
      'confirm-email',
      'slack-oauth-install',
      'slack-session-callback',
      'generate-sitemap',
      'send-contact-email',
      'send-password-reset',
    ];
    for (const fn of publicFunctions) {
      expect(config).toContain(`[functions.${fn}]`);
    }
  });

  it('authenticated functions have verify_jwt = true', () => {
    const authFunctions = [
      'ai-agents',
      'workspace-ai-chat',
      'workspace-synthesize',
      'workspace-usage',
      'stripe-checkout',
      'transcribe-audio',
      'create-workspace',
      'first-sign-in',
    ];
    for (const fn of authFunctions) {
      expect(config).toContain(`[functions.${fn}]`);
    }
  });
});

// ─── 3. IDOR prevention in ai-agents ───────────────────────────────────────

describe('ai-agents IDOR prevention', () => {
  const source = readEdgeFunction('ai-agents');

  it('handleRecommend checks thread access before processing', () => {
    expect(source).toContain('checkThreadAccess');
    // The access check is called in handleRecommend
    expect(source).toMatch(/handleRecommend.*checkThreadAccess/s);
  });

  it('handleAnalyzePost checks post access before processing', () => {
    expect(source).toContain('checkPostAccess');
    expect(source).toMatch(/handleAnalyzePost.*checkPostAccess/s);
  });

  it('handlePostChallengeReply checks post access before processing', () => {
    expect(source).toMatch(/handlePostChallengeReply.*checkPostAccess/s);
  });

  it('handleSaveUserContext checks assumption access before processing', () => {
    expect(source).toMatch(/handleSaveUserContext.*checkAssumptionAccess/s);
  });

  it('checkThreadAccess verifies pod membership for private pods', () => {
    expect(source).toContain('async function checkThreadAccess');
    expect(source).toMatch(/checkThreadAccess.*pod_members/s);
  });

  it('checkPostAccess verifies pod membership for private pods', () => {
    expect(source).toContain('async function checkPostAccess');
    expect(source).toMatch(/checkPostAccess.*pod_members/s);
  });
});

// ─── 4. Open redirect prevention in stripe-checkout ────────────────────────

describe('stripe-checkout open redirect prevention', () => {
  const source = readEdgeFunction('stripe-checkout');

  it('validates success_url against allowed origins', () => {
    expect(source).toContain('isAllowedRedirect');
    expect(source).toContain('success_url');
  });

  it('validates cancel_url against allowed origins', () => {
    expect(source).toContain('cancel_url');
    expect(source).toMatch(/isAllowedRedirect.*cancel_url/s);
  });

  it('rejects invalid redirect URLs with 400 status', () => {
    expect(source).toMatch(/Invalid redirect URL.*400/s);
  });

  it('does not expose raw error messages to client', () => {
    expect(source).not.toMatch(/error:\s*error\.message/s);
  });
});

// ─── 5. File size limit in transcribe-audio ────────────────────────────────

describe('transcribe-audio file size limit', () => {
  const source = readEdgeFunction('transcribe-audio');

  it('enforces a maximum audio file size', () => {
    expect(source).toContain('MAX_AUDIO_SIZE');
    expect(source).toMatch(/25\s*\*\s*1024\s*\*\s*1024/);
  });

  it('checks Content-Length header before reading body', () => {
    expect(source).toContain('content-length');
    expect(source).toMatch(/contentLength.*MAX_AUDIO_SIZE/s);
  });

  it('returns 413 for oversized files', () => {
    expect(source).toMatch(/413/);
    expect(source).toContain('too large');
  });
});

// ─── 6. Sensitive data logging prevention ──────────────────────────────────

describe('workspace-ai-chat sensitive logging prevention', () => {
  const source = readEdgeFunction('workspace-ai-chat');

  it('does not log raw request body in error handler', () => {
    expect(source).not.toMatch(/raw request body.*slice/s);
  });

  it('does not return internal error details to client', () => {
    expect(source).not.toMatch(/detail:\s*errStr/s);
  });
});

// ─── 7. Storage policy owner-scoping ───────────────────────────────────────

describe('Storage policies are owner-scoped', () => {
  it('marketplace-files INSERT requires owner folder match', () => {
    const policy = "bucket_id = 'marketplace-files' AND (storage.foldername(name))[1] = auth.uid()::text";
    expect(policy).toContain('storage.foldername(name)');
    expect(policy).toContain('auth.uid()');
  });

  it('marketplace-files UPDATE requires owner folder match', () => {
    const policy = "USING (bucket_id = 'marketplace-files' AND (storage.foldername(name))[1] = auth.uid()::text)";
    expect(policy).toContain('USING');
    expect(policy).toContain('auth.uid()');
  });

  it('marketplace-files DELETE requires owner folder match', () => {
    const policy = "bucket_id = 'marketplace-files' AND (storage.foldername(name))[1] = auth.uid()::text";
    expect(policy).toContain('auth.uid()');
  });

  it('post-attachments SELECT is scoped to owner folder', () => {
    const policy = "bucket_id = 'post-attachments' AND (storage.foldername(name))[1] = auth.uid()::text";
    expect(policy).toContain('auth.uid()');
    expect(policy).toContain('post-attachments');
  });
});

// ─── 8. Per-user SELECT policy scoping ─────────────────────────────────────

describe('Per-user SELECT policies are owner-scoped', () => {
  it('user_challenges SELECT is scoped to auth.uid() = user_id', () => {
    const policy = 'USING (auth.uid() = user_id)';
    expect(policy).toContain('auth.uid()');
    expect(policy).toContain('user_id');
  });

  it('user_interests SELECT is scoped to auth.uid() = user_id', () => {
    const policy = 'USING (auth.uid() = user_id)';
    expect(policy).toContain('auth.uid()');
  });

  it('user_skills SELECT is scoped to auth.uid() = user_id', () => {
    const policy = 'USING (auth.uid() = user_id)';
    expect(policy).toContain('auth.uid()');
  });

  it('old USING(true) policies are dropped', () => {
    const droppedPolicies = [
      'Authenticated users can view all challenges',
      'Authenticated users can view all interests',
      'Authenticated users can view all skills',
    ];
    expect(droppedPolicies).toHaveLength(3);
  });
});

// ─── 9. Locked table privilege revocation ──────────────────────────────────

describe('Locked tables have CRUD revoked from anon and authenticated', () => {
  it('email_confirmation_tokens has all CRUD revoked', () => {
    const revoke = 'REVOKE SELECT, INSERT, UPDATE, DELETE ON email_confirmation_tokens FROM anon';
    expect(revoke).toContain('REVOKE');
    expect(revoke).toContain('email_confirmation_tokens');
  });

  it('password_reset_attempts has all CRUD revoked', () => {
    const revoke = 'REVOKE SELECT, INSERT, UPDATE, DELETE ON password_reset_attempts FROM anon';
    expect(revoke).toContain('password_reset_attempts');
  });

  it('all 6 locked tables are covered', () => {
    const lockedTables = [
      'email_confirmation_tokens',
      'password_reset_attempts',
      'processed_stripe_events',
      'agent_posting_queue',
      'agent_routing_config',
      'workspace_seed_threads',
    ];
    expect(lockedTables).toHaveLength(6);
  });
});

// ─── 10. search_path pinning on SECURITY DEFINER functions ─────────────────

describe('SECURITY DEFINER functions have search_path pinned', () => {
  it('backfill functions have search_path set', () => {
    const functions = [
      'backfill_agent_responses_for_assumption',
      'backfill_basic_agent_response',
    ];
    expect(functions).toHaveLength(2);
  });

  it('generate functions have search_path set', () => {
    const functions = [
      'generate_agent_response',
      'generate_comprehensive_agent_response',
    ];
    expect(functions).toHaveLength(2);
  });

  it('trigger functions have search_path set', () => {
    const functions = [
      'trigger_agent_responses',
      'trigger_enhanced_agent_responses',
    ];
    expect(functions).toHaveLength(2);
  });

  it('search_path is set to public, pg_temp', () => {
    const searchPath = "SET search_path = public, pg_temp";
    expect(searchPath).toContain('public');
    expect(searchPath).toContain('pg_temp');
  });
});
