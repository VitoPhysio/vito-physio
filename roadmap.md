# Roadmap

- [x] Enable tap/long-press replies and reactions, and swipe-right replies in chats.
- [x] Apply existing message interaction schema and test interaction rules (25 focused tests pass).
- [x] Include Delete for me and sender-only Delete for everyone (database enforces sender ownership).
- [ ] Verify interactions in a signed-in chat. Blocked: external authenticated test session unavailable.
- [ ] Deliver chat changes as a separate open GitHub pull request.

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
