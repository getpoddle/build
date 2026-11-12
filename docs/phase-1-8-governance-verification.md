# Phase 1.8: Governance Readiness Verification

Status legend: VERIFIED (run and passed), ASSESSED (reviewed from code, not executed), MANUAL (needs a person with two live accounts), UNVERIFIED (not confirmed).

## 1. Access fixes applied

Two migrations were applied to the live database. Neither changes table grants, policies, or function signatures.

- `restrict_role_helper_disclosure`: role and membership helpers (`get_workspace_role`, `get_organization_role`, `is_workspace_admin_or_owner`, `is_decision_owner`, `is_evidence_reviewer`, `can_verify_evidence`) answer only for the signed-in user, or for co-members in the case of workspace and organization roles. `get_decision_benchmark_stats` returns NULL below 5 contributions.
- `restrict_membership_usage_and_training_stats_disclosure`: `is_workspace_member` answers only for the signed-in user. `get_my_training_contribution_count` returns a count only for the signed-in user. `get_workspace_war_room_usage` returns no rows to non-members (admins excepted). `get_training_dataset_stats` is admin-only.

VERIFIED: a signed-in outsider gets NULL or no rows for other users and workspaces. A workspace owner still sees their own role, membership, and usage. Checked in a rolled-back transaction against live data.

Callers reviewed: `create_decision_snapshot` and `request_reverification` pass the caller's ID (`request_reverification` was checked by name only, not body). `register_decision_evidence_file` passes `auth.uid()`. The benchmark card in `CrossWorkspacePatternCard` already handles a NULL result. The admin dashboard is the only caller of `get_training_dataset_stats`.

## 2. SECURITY DEFINER inventory (52 functions callable by signed-in users)

No function is callable by `anon`.

| Class | Functions | Result |
|---|---|---|
| Caller-scoped (uses `auth.uid()`) | Most workspace, decision, evidence, organization, invite, and account functions | ASSESSED: caller ID is taken from the session. Accepted. |
| Admin-gated (checks `admins`) | `get_admin_all_users`, `get_admin_all_workspaces`, `get_admin_user_workspaces`, `get_profiles_sensitive_admin`, `is_admin` | VERIFIED for the first four bodies (gate present). |
| Admin actions | `ban_user_account`, `suspend_user_account`, `approve_verification`, `reject_verification` | VERIFIED: admin gate present (`profiles.is_admin` or `admins` table). |
| Self-only | `restore_account` | VERIFIED: caller must equal the target user. |
| Fixed this phase | Helper and benchmark functions listed in section 1 | VERIFIED. |
| Accepted, low risk | `is_workspace_public` (public flag only), `lookup_referral_code` (needed at sign-up), `check_username_available`, `suggest_usernames`, invite-token lookups (the token is the secret), `increment_*` counters | ASSESSED. Accepted. |
| Trigger function | `log_decision_evidence_link` | VERIFIED: runs only as a trigger; PostgreSQL rejects direct calls. Low risk. EXECUTE revoke is optional hygiene. |
| Not individually re-read | The remainder (about 20) | ASSESSED by name and caller check only. |

Caller checks for the changed helpers:
- `decision_lifecycle_action` sets `v_uid := auth.uid()` (VERIFIED).
- Every RLS policy that uses the helpers passes `auth.uid()` (VERIFIED against the live policy list).
- Triggers and service-role code do not call the role helpers directly. Service-role and trigger callers see unchanged behavior, because the guards only apply when a signed-in user is present.

Remaining open items on this inventory: none that block release. The organization-level and approval helpers are covered above.

## 3. Concurrency assessment

ASSESSED from code (no multi-session test was run):

- `decision_lifecycle_action` takes a row lock on the workspace before changing state, so two simultaneous approvals serialize.
- `decision_invalidate_on_material_change` takes a row lock, so an edit racing an approval serializes against it.
- `revise_evidence_claim`, `reverify_decision_claim` also take row locks.
- `create_decision_snapshot` takes no row lock. Two simultaneous snapshots could both be written. Low impact: each snapshot is a separate immutable record.

The single-session SQL tests in `supabase/tests/decision_approval_integrity.sql` cannot prove concurrent behavior. A two-session check is still needed (see section 4).

## 4. Manual two-user test (not executed; no live accounts were available)

Prerequisites: two accounts that are both owner or admin of one workspace, plus a third account that is not a member.

1. User A opens the workspace, edits the recommendation, and submits for approval. Choose User B as the approver.
2. User B approves. Confirm the decision shows as approved.
3. User B edits the recommendation. Confirm the status returns to draft.
4. User B tries to approve again. Confirm it is refused.
5. User A submits again, and User B rejects without a reason. Confirm the reason is required.
6. User B rejects with a reason. Confirm the reason appears in the history.
7. User A revises and resubmits. Confirm the approved version in history is unchanged.
8. The third account tries to approve, and tries to open another workspace's decision. Confirm both are refused.
9. Remove User B as approver while a request is pending. Confirm the request cannot be approved by User B afterwards.
10. Concurrency: open two browser sessions as User A and User B. Click approve in both at the same moment. Expect one success and one refusal, and no duplicate approval.

## 5. Reproducibility gap

From the Phase 1.7.1 analysis: 352 objects exist in the live database with no matching migration file in the repository, and 9 repository migration files have objects that are live but missing from the migration history table.

- Do not replay migrations against production.
- Do not insert history rows to paper over the gap.
- Fix path: capture a schema dump from the live database into a baseline migration in a fresh project, then verify a rebuild produces the same objects.

UNVERIFIED in this phase: the counts above are from the earlier analysis and were not recomputed.

## 6. Leaked-password protection

UNVERIFIED. The security advisor report reviewed in this phase was too large to confirm the setting, and no tool here reads the authentication settings.

Dashboard steps: open the project in the Supabase dashboard, go to Authentication, then Sign In / Providers, then Password. Turn on the option to prevent use of leaked passwords (HaveIBeenPwned check), then save. Re-run the security advisor afterwards; the lint should be gone.

## 7. Verification run

- Unit tests: 12 files, 328 passed, 6 skipped, 10 todo (run after both migrations).
- Typecheck: passed (after both migrations).
- Production build: passed (run before the second migration; no source files changed since).
- Approval SQL integrity tests: all outcomes matched expectations (run after the first migration). Not rerun after the second migration; the approval path does not call the changed functions except `create_decision_snapshot` and `request_reverification`, which were reviewed above.
- Security advisor: rerun not fully read (clipped output).
