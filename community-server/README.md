# Community service setup

The desktop works without this service. Shared feature requests, Discord identity, moderation and webhook delivery require owner configuration.

Use a Cloudflare Workers **Free** account and D1 Free. Stay on the free plan; service limits can make it unavailable when exhausted. There is no paid-plan enrollment in this project. Skin submissions are links, so this preview does not require paid object storage or distribute executable user uploads.

1. Create a Discord developer application. Enable OAuth with the `identify` scope only. Set its callback to `https://YOUR_WORKER.workers.dev/auth/callback`.
2. Create a D1 database, put its ID in wrangler.jsonc, and apply schema.sql with Wrangler.
3. Set PUBLIC_ORIGIN to the exact HTTPS origin, DISCORD_CLIENT_ID to the app ID, and DISCORD_OWNER_ID to your own Discord user ID. Owner moderation is enforced on the server.
4. Use `wrangler secret put DISCORD_CLIENT_SECRET` and `wrangler secret put DISCORD_WEBHOOK` interactively. Never write these secrets in this repository or desktop configuration. The webhook must be your Discord incoming webhook URL.
5. Deploy the Worker. Set src/distribution.json's communityOrigin to the same origin, then rebuild the desktop release.
6. Test browser approval, sign-out, two separate community accounts, non-owner moderation rejection, a request delivered to Discord, a pending skin hidden from the public gallery, and owner approval before announcing public community features.

Desktop sign-in opens the browser, uses Discord approval, then returns through a local loopback callback with PKCE. The app receives its own scoped community session, not a Discord account token. Windows encrypts the saved session when secure storage is available. Server sessions expire after 30 days and are stored hashed.

Requests show the Discord display name and timestamp; Discord identity IDs supply authorization, so identical display names do not imply the same account. Colors are user-selectable and adjusted for readable contrast. There is no separate password database.

Features are public immediately and can be accepted, declined or hidden. Skin links require creator permission and owner approval before appearing. Discord receives an owner review notification with mentions disabled. The service never fetches submitted skin URLs. Review external files independently; approval does not prove a file is safe or licensed.

Notification delivery uses an outbox. A known rate-limit response can retry on the scheduled job; an ambiguous network response is held to avoid duplicate messages. Database `notifications.sent`: 0 pending, 1 delivered, 2 claimed/uncertain. Review uncertain delivery manually. This does not guarantee exactly-once delivery to Discord.

The public feed is limited to 100 recent entries and refreshes every 30 seconds while its desktop page is visible. Posting limits are per account and per IP. These controls reduce abuse but cannot promise unlimited availability on a free service.

## Attachment safeguards (local, activation pending)

Attachments use a private Standard R2 bucket and the Worker checks visibility and ten-day expiry before reading an object. The desktop accepts three attachments per request: images up to 8 MiB and videos up to 25 MiB. The existing ten-day lifecycle policy remains active independently of the new budget gate.

The new gate requires an owner-verified account usage baseline and actual billing-period boundaries in `r2_budget`. Missing, unverified or expired periods stop uploads and reads before any R2 PUT/GET. There is no automatic calendar reset and no invented baseline. Limits are 5,000,000,000 stored bytes, 500,000 Class A operations and 5,000,000 Class B operations, with an 80% warning from the owner usage endpoint. D1 batches reserve usage atomically before dispatch; retries and failed/uncertain requests retain operation counts. Every range GET reserves another read. PUT explicitly selects Standard storage.

Storage reservations are released only after confirmed deletion. PUT failures remain quarantined because a timed-out write may complete after an immediate compensating delete. The proposed cleanup also handles incomplete writes and ledger-only orphan reservations older than eleven days; this **new cleanup behavior is not authorized for live activation yet** and is disabled unless `MEDIA_QUARANTINE_CLEANUP` is explicitly set to `approved` after authorization. Existing ready attachment expiration and orphan cleanup should continue. Legacy ready objects without ledger entries remain eligible for cleanup.

Before deployment: verify account-wide current usage, all other buckets/access paths, actual billing boundaries and existing objects; reconcile/backfill ledger accounting without omitting uncertain objects. Record the trusted baseline and source. Do not reset counters or release quarantine merely to regain headroom. Reconcile after the billing period ends before setting a new period. Deletion is free of Class A/B reservation and existing cleanup is not paused by a missing usage baseline. Direct public URLs, other Workers/buckets and external account traffic bypass this app's counters, so these limits cannot guarantee a zero Cloudflare bill. No credentials should be extracted to automate the dashboard verification.

Current local validation: SQLite transaction tests cover concurrency, cap exhaustion, rollback, unknown periods, retries, PUT/GET timeouts, explicit Standard uploads, legacy cleanup and failed/duplicate deletion. The new schema, accounting and cleanup changes require review and verified baseline before live deployment.

