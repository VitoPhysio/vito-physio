# Notification delivery setup and verification

## Delivered
- Persisted event notifications, category preferences, user-scoped device registration, realtime in-app counts and browser badges where supported.
- Firebase web registration and dedicated messaging worker (PWA skill: no offline app-shell caching).
- Private message previews, conversation destinations, read synchronization, per-actor deduplication, durable device delivery queue and retry callback.

## Required before live delivery
1. Update the linked Firebase connection with **Include web push**: web API key, app ID and public VAPID key. These public browser values are currently unavailable.
2. Set `NOTIFICATION_WEBHOOK_SECRET` privately in the app hosting settings. Use the same secret in an external scheduler's `Authorization: Bearer ...` header; never put it in source.
3. Publish and schedule POST requests to `/api/public/notification-delivery` every minute. For faster delivery, also configure a Supabase database webhook on inserts into `notification_deliveries`, using that authenticated endpoint. Neither scheduler nor webhook is configured by this change.
4. Deploy the Firebase connector server credentials and existing external Supabase server credentials on the GitHub app's hosting service. Lovable connection secrets do not automatically appear on another host.
5. Test web push from a top-level browser tab; iPhone web push requires an installed home-screen web app on supported iOS. Native Capacitor push/APNs registration is not implemented by this web-push change.

## Verification
- Notification privacy, retry, stale-token and safe destination tests pass; existing gesture/navigation tests pass.
- Local harness reports build OK.
- Real signed-in delivery, physical Android/iOS foreground/background/closed-app delivery, badge sync, and multi-device acceptance remain unverified; do not treat this PR as device acceptance.
- Clinical events currently notify linked guardians; athlete/staff recipient expansion, mentions/replies event coverage and native push remain incomplete.
- Delivery is at least once, with a stable notification tag; a provider success followed by a failed database write can resend. No exactly-once guarantee.
- Existing database audit has 33 unrelated warnings, including password leak protection being disabled; review separately.

## GitHub preservation
Apply notification additions to the latest main, retaining existing attachment chat features, native folders and dependency versions. Do not replace the whole project with the older local checkout.
## Architecture (chat vs. notification bell)
- **Messages system** (`messages`, `conversations`, `conversation_participants.last_read_at`, `message_hidden`) owns chat. Unread counts come from `message_unread_count()` / `conversation_unread_counts()` and drive the Messages icon in the bottom navigation, refreshed in real time.
- **Chat device pushes** use their own queue `message_push_deliveries` (filled by the `message_notification` trigger). Chat no longer writes `notifications` rows. Sender name + preview (respecting `notification_preferences.message_preview_enabled`), tag per conversation, tap opens `/messages?conversation=<id>`. Skipped when the recipient already read the message.
- **Notification bell** (`notifications` + `notification_deliveries`) covers followers, reactions, comments, appointments (new, changed, cancelled), booking request responses, announcements. `notification_badge_count()` and `mark_all_notifications_read()` ignore legacy `messages` rows, which remain stored for history.
- **Duplicates**: web pushes are data-only; the service worker and foreground handler do not show an OS alert while VITO is focused. Native Android/iOS tokens get a system notification payload.
- **Device registry / preferences** stay in `user_device_tokens` and `notification_preferences`.

## Acceptance checks run against the connected database (rolled back)
- A: a direct message left the recipient's bell rows unchanged (4→4) and raised Messages unread 0→1.
- B: a follow added a follower bell item (0→1).
- C: cancelling an appointment added a bell item for the athlete/guardians (6→7) and queues device pushes for registered devices.
- D: reading the conversation dropped Messages unread 1→0 while the bell stayed at 1.
- E: "Mark all read" only touches `notifications`; conversation read state is untouched by design.
- No device tokens are registered yet, so real phone delivery is unverified until a device enables notifications (Notifications → Enable on this device) and the Firebase web push keys are set.
