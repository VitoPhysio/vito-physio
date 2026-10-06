# Secure account access and editable photos

## What will change
- Add a unique personal VITO account ID to every account and show it after sign-in; the sign-in field will accept either this ID or an email address.
- Keep organisation and athlete record IDs for linking records only, avoiding ambiguous or unsafe access to shared medical records.
- Add signed-in photo editing for each user's profile and, where linked, their athlete photo or school/academy/club logo.
- Keep account approval and removal available on the VITO admin page, with current super-admin safeguards.
- Replace the hosted logo pointer with a real logo file tracked in the connected GitHub repository.
- Address actionable security findings, then verify the key sign-in/photo screens and current build.

## Technical details
- Resolve account IDs to email only inside a rate-conscious server function, authenticate with Supabase, and return the session to the requesting browser without exposing account email lookup publicly.
- Generate immutable unique account IDs in the database and expose them only to the account owner and authorized VITO administrators.
- Authorize each later photo update against the signed-in user's profile or existing athlete/organisation link before privileged storage/database changes.
- Preserve private image storage and signed image URLs.
