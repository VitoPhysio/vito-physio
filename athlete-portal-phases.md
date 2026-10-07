# Athlete portal delivery

## Phase 1 — Lightweight MVP interface
- Home, Discover and Profile are connected authenticated pages. Acceptance: all three open and preserve access to the existing dashboard, linking and management pages.
- Health comes first: injuries, recovery stages, rehabilitation/exercises, assessments, appointments, follow-ups, reports and care updates reuse existing records. Acceptance: only linked athlete data is read; failures show an error rather than invented values.
- Injury reporting and clinical requests reuse existing server functions. Acceptance: a report lands in the clinical case system; requests appear in private communications.
- Profile name and profile photo reuse the existing account. Acceptance: edits refresh the displayed identity.
- Network, activity, sporting profile fields and discovery categories have honest empty states. Acceptance: no mock members, clinical directory, fake connection requests or fabricated opportunities.
- Mobile layout: three navigation items, wrapping shortcuts, scrollable dialogs. Acceptance: no horizontal overflow at phone widths.

## Phase 2 — Community integration
- Add opt-in sporting identity, event/position, school/team, biography, achievements, skills and interests; connect profile forms to permission-controlled storage.
- Add a cover-photo picker and sporting-photo gallery using the existing private photo approach with explicit community consent.
- Implement discover search/filtering over explicitly opted-in community data, never clinical athlete records.
- Add connection requests, accept/remove controls and permitted member profiles with authorized read/write paths.
- Add optional non-sensitive sporting milestones and connection activity. Never auto-share medical events.
Acceptance: accounts cannot read hidden profiles, impersonate activity authors or access medical records through community features.

## Phase 3 — Opportunities and refinements
- Real trials, teams, competitions, training, scholarships and recruitment listings.
- Dedicated community notifications, clinical read receipts and richer profile presentation.
Acceptance: listings and notifications come from real authorized data and retain separation from private clinical communication.

## Verification limitation
Public rendering and navigation can be tested locally. External Supabase has no managed signed-in test session: reporting, messaging, account edits and clinical readback need a real authenticated acceptance pass before release.
