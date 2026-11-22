# Roadmap

## Institution administrator registration
- [ ] Use institution names, logos and authorized working emails in both registration paths.
- [ ] Correct the reported administrator role and preserve approval-based onboarding of additional admins.
- [ ] Keep administrator profiles aligned with institution identity; test registration and permissions.
- [ ] Verify signed-in onboarding. Blocked: external authenticated test session unavailable.

## Institutional workspace upgrade (brief)
- [x] Phase 1: workspace entry, institution chooser, join requests, registration, multi-institution switching, institution roles enforced in the database.
- [x] Phase 2: athlete directory, profiles, team and coach assignments (PR #101).
- [x] Phase 3: injury management, statistics, surveillance, pattern detection, prevention guidance (PR #101).
- [x] Phase 4: messaging screen (PR #112).
- [x] Phase 5: referral, consent and professional inbox screens (PR #112).
- [x] Phase 6: printable institution/surveillance report and per-team report (PR #112).
- [x] Institution Communications: fix sent-message history; deliver institution, VITO staff and clinician messages into two-way chats; add direct chat contacts.
- [x] Athlete alignment: athletes send requests/messages to VITO clinicians or their institution; staff and institutions answer from their dashboards; answers reach athletes.
- [x] Keep workspace interactions (requests, institution/clinical messages) in a separate Workspace inbox, distinct from social chats.
- [x] Add replyable Workspace message lists to athlete Requests and staff dashboards, with actual participant names.
- [x] Upload the combined athlete workspace files to GitHub main without replacing unrelated work; all 118 tests pass.
- [x] Rebuild the athlete workspace: status hero, quick actions, Overview/Recovery/Schedule/Requests/Records tabs.
- [ ] Verify two-way chats with real institution, staff and athlete accounts. Blocked: no signed-in test session available here.
- [ ] Phase 7: verify all workspace flows with real admin, coach, guardian and professional accounts. Blocked: no signed-in test session available here.

- [x] Add expandable branded Android alerts with Reply and Mark as read actions, keeping older APK delivery intact.
- [x] Test notification action routing and deployment lockfile compatibility (previous GitHub checks).
- [ ] Verify alerts on a physical phone. Blocked: new APK installation and signed-in Android device unavailable here.

- [x] Fit shared message screens to phone widths with shrinkable columns, names and message content.
- [x] Open chat photos in-app with pinch zoom, download and forwarding; share and forward messages.
- [x] Run focused checks (20 tests pass; preview redirects signed-out messages to sign-in without runtime errors).
- [ ] Verify these changes in signed-in phone chats. Blocked: external authenticated test session unavailable.

- [x] Organise clinician and admin dashboards with horizontal dropdown menus.
- [x] Group cases by status and sort by newest or athlete name.
- [x] Enable editing saved case opening and management information using existing access rules.
- [x] Test case organisation and editing rules (14 focused tests pass, including save failure and original-row update).
- [x] Deliver dashboard and case-workspace changes as open GitHub PR #62; main remains unchanged.
- [ ] Verify signed-in case saving. Blocked: external authenticated test session unavailable.

- [x] Enable tap/long-press replies and reactions, and swipe-right replies in chats.
- [x] Apply existing message interaction schema and test interaction rules (25 focused tests pass).
- [x] Include Delete for me and sender-only Delete for everyone (database enforces sender ownership).
- [ ] Verify interactions in a signed-in chat. Blocked: external authenticated test session unavailable.
- [x] Deliver chat changes as separate open GitHub PR #61; main remains unchanged.
- [ ] Verify final production diagnostics. Blocked: current diagnostic logs are absent; earlier strictness errors are not confirmed resolved.
- [ ] Add deletion-specific regression coverage and make repeated Delete for me idempotent. Review limitation recorded in PR #61.

- [x] Align post author photos with their names.
- [x] Provide role-specific profile settings while preserving athlete settings.
- [x] Deliver only these changes on role-specific-profiles with open GitHub PR #60.
- [ ] Verify signed-in role-specific profile saving and author alignment. Blocked: external authenticated test session unavailable; review limitations are recorded in PR #60.

- [x] Restore the saved /index preview address to the existing GitHub Vito homepage and verify sign-in navigation.

- [x] Add secure email-or-personal-ID sign-in.
- [x] Add editable profile, athlete, and organisation photos.
- [x] Keep account approvals and removals available to VITO administrators.
- [x] Store the full VITO logo in the GitHub-tracked project.
- [ ] Verify the signed-in experience and final security/build state. Blocked: external sign-in session unavailable; existing code diagnostics and unapplied messaging schema require further repair and database approval.
- [x] Complete athlete Home, Discover and Profile interface architecture while preserving the staff dashboard.
- [x] Connect existing health records, reporting, appointments and private clinician messages.
- [x] Provide honest empty states for community features awaiting integration.
- [x] Record MVP, future phases and acceptance criteria.- [x] Registration: email+password sign-up, choose existing school/club/academy, athletes searchable on admin
- [x] Remove clinician-entered athlete number; only generated athlete ID
