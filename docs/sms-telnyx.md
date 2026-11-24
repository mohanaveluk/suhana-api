# SMS (Telnyx) — OTP delivery

SMS is an **additional** channel. Email delivery is unchanged and remains the fallback everywhere.

| Flow | Channel |
|---|---|
| Mobile verification (`/v1/users/mobile/send-verification`, `resend-verification`) | SMS only, to the number being verified (may be unverified). `is_mobile_verified = 1` is set only after `/verify` succeeds. |
| Login one-time code (`/v1/auth/login/send-otc`) | SMS if Telnyx is enabled **and** `is_mobile_verified = 1` **and** the mobile number is valid E.164; otherwise email. SMS failure → email. |
| Forgot password (`/v1/auth/forgot-password`) | Same rule as login. |
| All other notifications | Unchanged (email). |

Responses are generic ("…sent to its email or verified mobile number"), so they reveal neither whether an account exists nor which channel was used.

## Site-wide on/off switch (admin panel)

Texts are sent only when **both** are on:

| Switch | Where | Change takes effect |
|---|---|---|
| `TELNYX_ENABLED` + credentials | Environment / Secret Manager | New Cloud Run revision (deploy-level: "is SMS set up here?") |
| `sms_sending_enabled` | `app_settings` table, toggled in **Admin → Site Settings** (`/admin/settings`) | Within ~30 s on every instance, no deploy |

- API: `GET` / `PATCH /api/v1/admin/settings/sms` `{ "enabled": true|false }` (JWT + `admin` role). Every change is audited (`SYSTEM_SETTING_CHANGED`, with old/new value and who changed it).
- Enforced inside `SmsService.send()`, so **every** text (current and future features) obeys it. When off, `send()` returns `SMS_DISABLED` and nothing reaches Telnyx.
- Effect when off: login and password-reset codes go by email; mobile verification returns "SMS verification is temporarily unavailable" (502).
- The migration `1784334400000-add-app-settings` seeds it as `true`, so behaviour is unchanged until an admin turns it off.
- If the database is unreachable, the last known value is used, falling back to the default (`true`). The env switch still applies.

## Code layout

```
src/shared/sms/
  sms.types.ts                 SmsSendResult, SmsErrorCode, SmsProvider, E164, maskPhone
  sms.config.ts                readSmsConfig() — env → config, never throws
  sms.service.ts               send() → SmsSendResult; sendSms() → boolean (back-compat); tracking
  sms.module.ts                provider selection: Telnyx → dev log-only → disabled
  providers/telnyx-sms.provider.ts   official `telnyx` SDK, error mapping, bounded retries
  providers/log-sms.provider.ts      development only, console (never DB)
  entity/sms-message.entity.ts       sms_messages (no content, masked + hashed number)
  sms-webhook.controller.ts / .service.ts   POST /api/v1/sms/webhooks/telnyx
src/shared/otp/
  otp-policy.ts                TTLs, attempt / resend / per-number limits, crypto code generator
  otp-sms.templates.ts         SMS texts
  otp-delivery.service.ts      SMS-vs-email decision + fallback for login / reset
```

## Configuration

| Variable | Secret? | Default | Notes |
|---|---|---|---|
| `TELNYX_ENABLED` | no | `false` | Master switch. |
| `TELNYX_API_KEY` | **yes** | — | Secret Manager in production. Never in git, YAML, Dockerfile or the frontend. |
| `TELNYX_FROM_NUMBER` | no | — | E.164 number on the messaging profile (10DLC or toll-free). |
| `TELNYX_MESSAGING_PROFILE_ID` | no | — | Optional. |
| `TELNYX_PUBLIC_KEY` | no (public) | — | Base64 ed25519 key from Mission Control. Without it, webhooks are rejected with 401. |
| `SMS_LOG_ONLY` | no | `true` outside production | Dev only: prints texts to the console when Telnyx is off. Always off in production. |
| `OTP_TTL_MINUTES_MOBILE_VERIFICATION` / `_LOGIN` / `_PASSWORD_RESET` | no | 10 / 15 / 5 | 1–60. |

If `TELNYX_ENABLED=true` but the key or number is missing or invalid, the app starts, logs a warning, and behaves as if SMS were disabled.

## Security controls

- Codes: `crypto.randomInt`, 6 digits, bcrypt-hashed at rest, one-time use (conditional `UPDATE … WHERE used = false`), previous codes invalidated on resend.
- Limits: 5 wrong guesses per code (then burned); 3 codes per account per 15 minutes (login/reset: silently ignored with the same response); 5 SMS per phone number per 60 minutes across all accounts (toll-fraud guard; login/reset fall back to email).
- Logs and the DB never contain OTPs or message text (dev log-only mode prints to the console only). Phone numbers are masked; `sms_messages` stores a masked number plus a SHA-256.
- Retired the legacy `/auth/mobile/login`, `/auth/mobile/validate` and `/auth/mobile/send-otc` routes. They now return 410: they stored plaintext codes, allowed brute force, enumerated numbers, and could mint a JWT for any number. No client used them.

## Telnyx error handling

| Telnyx | `errorCode` | Retried? |
|---|---|---|
| 400 | `INVALID_REQUEST` | no |
| 401 | `AUTH_FAILED` | no |
| 403 | `FORBIDDEN` (often unregistered 10DLC/number) | no |
| 422 (destination) / other | `INVALID_NUMBER` / `INVALID_REQUEST` | no |
| 429 | `RATE_LIMITED` | yes: up to 2 retries, honouring `Retry-After` ≤ 5 s |
| 502 / 503 | `PROVIDER_ERROR` | yes: exponential backoff + jitter (0.5 s → 4 s cap) |
| 500 / 504 | `PROVIDER_ERROR` | no (the request may have been processed) |
| timeout (10 s) | `TIMEOUT` | **no**: the message may already have been accepted, so a retry could send a second code |
| connection error | `NETWORK_ERROR` | no |

The SDK's own retries are disabled (`maxRetries: 0`) because they would retry timeouts.

## Telnyx account setup (one time)

1. Create a Telnyx account, complete identity verification, and add billing.
2. **Messaging → Messaging Profiles → Add**. Note the profile ID (`TELNYX_MESSAGING_PROFILE_ID`).
3. Buy an SMS-capable number and assign it to the profile (`TELNYX_FROM_NUMBER`, E.164).
4. **US A2P 10DLC registration** (required for US long codes). In Messaging → 10DLC:
   - Register the **Brand** (legal business name, EIN, address, website).
   - Register a **Campaign** with use case "2FA / Account Notification". Sample messages are the texts in `otp-sms.templates.ts`. Opt-in description: "User enters their number in Aurora Matrimony and requests a code". Include HELP/STOP handling. Telnyx handles STOP/HELP keywords by default.
   - Once the campaign is approved, assign the number to it.
   - Alternative: a **toll-free number** with toll-free verification.
   - Until approval, carriers block or filter messages (`403` or delivery failures). **A working API key does not mean the number is approved for production traffic.** Check that the campaign status is *Active* before enabling.
5. **API Keys → Create** (`TELNYX_API_KEY`). Store it straight into Secret Manager. Don't paste it into files or chat.
6. **Account → Public Key**: copy it (`TELNYX_PUBLIC_KEY`).
7. On the messaging profile, set **Webhook URL** = `https://<api-host>/api/v1/sms/webhooks/telnyx` (API v2 webhooks).
8. For international numbers, enable the destination countries under the profile's outbound settings.

## Google Cloud Secret Manager

Run these with an account authorised for the project. They are not run automatically, and nothing in the repo was changed to require them.

```bash
PROJECT=<gcp-project-id>
REGION=<region>
SA=$(gcloud run services describe suhana-api --region $REGION --format='value(spec.template.spec.serviceAccountName)')
# (empty → the default compute SA: <project-number>-compute@developer.gserviceaccount.com)

gcloud services enable secretmanager.googleapis.com --project $PROJECT

# Create the secret; the key is read from stdin, never as an argument or a file in the repo
gcloud secrets create TELNYX_API_KEY --replication-policy=automatic --project $PROJECT
printf '%s' "$TELNYX_KEY_FROM_PASSWORD_MANAGER" | gcloud secrets versions add TELNYX_API_KEY --data-file=- --project $PROJECT

gcloud secrets add-iam-policy-binding TELNYX_API_KEY \
  --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project $PROJECT

gcloud run services update suhana-api --region $REGION --project $PROJECT \
  --update-secrets=TELNYX_API_KEY=TELNYX_API_KEY:latest \
  --update-env-vars=TELNYX_ENABLED=true,TELNYX_FROM_NUMBER=+1XXXXXXXXXX,TELNYX_MESSAGING_PROFILE_ID=<id>,TELNYX_PUBLIC_KEY=<base64>
```

- **Per environment:** use a separate secret per project (staging/production), or `TELNYX_API_KEY_STAGING`, mapped with `--update-secrets=TELNYX_API_KEY=TELNYX_API_KEY_STAGING:latest`.
- **Rotation:** add a new version, redeploy or restart the revision, then disable the old version.
- **Cloud Build:** once the secret exists, add `--update-secrets=TELNYX_API_KEY=TELNYX_API_KEY:latest` to the `gcloud run deploy` step in `cloudbuild.yaml`. Never use `--set-env-vars` for the key.
- **Local:** keep `TELNYX_ENABLED=false`, or export the key in your shell for a manual test. Don't write it into `.env.*`.

## Deployment checklist

1. Deploy the code. The migration `1784334300000-add-sms-messages-and-otp-attempts` creates `sms_messages` and adds `attemptCount`/`channel` to `login_otc_tokens` and `password_reset_tokens`. It is idempotent. With `DB_MIGRATIONS_RUN=false` in production, run it explicitly.
2. Leave `TELNYX_ENABLED=false` at first. Behaviour is identical to before, apart from the hardening listed above.
3. Once 10DLC/toll-free is approved: create the secret and set the env vars (above).
4. Startup log should show `SMS: Telnyx enabled (from +1XXXX*****NN)`. A warning means the configuration is incomplete.
5. Test with your own verified number:
   - Profile → Verify mobile.
   - Then log in with a one-time code; it should arrive by SMS.
   - Check `sms_messages.status` moves ACCEPTED → SENT → DELIVERED as webhooks arrive.
6. **Rollback:** set `TELNYX_ENABLED=false`. OTPs return to email immediately, with no code change.

## Tests

`npx jest src/shared src/modules/auth src/modules/user`. Telnyx is mocked throughout, and no SMS is sent.
