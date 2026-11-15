# Project memory

## Product intent & audience

- Supabase-backed web app (live at poddleme.com) with approval workflows requiring multiple independent approvers.
- Includes a decision trail / audit view showing approval events and organization-scoped membership.

## Brand personality & voice

- Production-grade, not template-feeling (per `.bolt/prompt`); UI expected to feel polished and complete.
- Interface text uses clear, human-readable labels (e.g. "X of Y approvers selected") rather than raw IDs or event-type codes.

## Visual design & UX direction

- Stack: Vite + React (JSX), Tailwind CSS, Lucide React icons; TypeScript throughout.
- Approval panel: approver rows render as selectable list with visible checkbox + checkmark; selected rows get distinct background, green border, and checkmark.
- Multi-select approver view is shown by default (previously gated behind a "Require multiple independent approvals" toggle that defaulted off — caused no visible change in a prior iteration).
- Submission disabled until ≥ 2 approvers selected; live counter shown.
- Name fallback chain: full name → first/last name → username → "Member ID" + 8-char identifier.
- Organization names resolved via authorized data; event types rendered as human-readable labels in Decision Trail.
- Components must be imported and rendered in active routes to count as done.

## Decisions, constraints & rationale

- Do not modify Supabase approval RPCs or existing approval security logic; preserve RLS and authorization rules.
- Organization name resolution restricted to members (authorized data only).
- Reuse / modify existing live components directly; avoid creating separate unused components.
- Project is currently not a Git repo — changes were not committed/pushed; deployment is outside the assistant's control.
- Tests pass (336 tests), `tsc` and production build pass after latest changes.

## Open questions & assumptions

- Live visual verification on poddleme.com could not be performed from the dev environment; deployment pipeline and Git repo setup are unconfirmed.
- Whether a Git repo should be initialized for commit tracking remains undecided.
- Exact set of human-readable event-label mappings may need expansion as new event types are added.