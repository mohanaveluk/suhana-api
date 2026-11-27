# One Aurora identity, several application roles

**Principle:** one email, one password, one `user` row, and a set of roles in `user_account_roles`
that decides which apps the person may use. Aurora Matrimony (`suhana`) and Aurora for Providers
(`aurora-providers-web`) have separate login pages and separate sessions but share this identity.

## Roles

| Role | App | Granted when |
|---|---|---|
| `MEMBER` | Aurora Matrimony | member registration (`POST /auth/register`), or `POST /auth/join-as-member` by an existing signed-in account |
| `PROVIDER` | Aurora for Providers | becoming OWNER of a Discover listing: provider registration, `POST /provider-portal/onboard`, an approved claim, or an admin assigning an owner |
| `PROVIDER_STAFF` | Aurora for Providers | becoming STAFF on a listing |
| `ADMIN` | both (+ admin screens) | **derived** from the legacy tier `user.role_id → roles.name = 'admin'` (unchanged) |
| `SUPER_ADMIN` | both | stored role only (no grant flow yet) |

- The legacy tier (`role_id`: admin / registered / guest / tester / user) is **not** changed; admin and tester behaviour is as before.
- `user.account_type` (MEMBER | PROVIDER) is kept, meaning "where the account was first created". It is informational only.
- A pre-roles account with no rows whose `account_type` isn't PROVIDER counts as `MEMBER`. This keeps the system backward compatible if the backfill hasn't run.
- Roles are only ever granted after the person proves they own the account (signing in, or a verified email, or an admin decision). An email address existing is never enough.
- Roles are not revoked automatically when a listing membership ends.
- Business **approval** is separate from authentication. A provider's listing is still DRAFT → SUBMITTED → PUBLISHED by admin review.

## Enforcement (server)

- `JwtStrategy.validate` reads the roles from the DB on every request (`request.user.roles`). They are never trusted from the token.
- `JwtAuthGuard`: an account with no member-app role (`MEMBER`/`ADMIN`/`SUPER_ADMIN`) gets 403 `{ code: 'MEMBER_ROLE_REQUIRED' }`. Routes that opt in with `@AllowProviderAccounts()` are the exception.
- `OptionalJwtAuthGuard`: an account without a member-app role is treated as anonymous.
- `AppRolesGuard` + `@RequireAppRoles(...)`: the provider-portal controller requires `PROVIDER`/`PROVIDER_STAFF` by default, and answers 403 `{ code: 'PROVIDER_ROLE_REQUIRED' }` otherwise.
  - `me`, `onboard`, `claimable`, `claims` are open to any signed-in account.
  - `register`, `resend-verification`, `categories` are public.
- Per-listing permission (OWNER/STAFF of *that* listing) is still checked in the services.

## Flows

- **Member → also a provider:** on "List your business", an existing email gets 409 `{ code: 'ACCOUNT_EXISTS' }` with "An Aurora account already exists with this email address. Please sign in to continue registering your business."
  - The provider site sends the person to sign in. After they sign in, `/get-started` calls `POST /provider-portal/onboard`.
  - That adds a draft listing they own (→ `PROVIDER`) and creates no new user.
  - They can claim an existing listing instead (`/get-started/claim`); approval grants `PROVIDER`.
- **Provider → also a member:** member login with a business-only account drops the session and offers "Create my matrimony profile".
  - The register wizard re-checks the password, then `POST /auth/join-as-member` creates the profile shell and grants `MEMBER` (no new user).
  - The wizard then saves the details with `PATCH /profiles/me`.
- **Provider login with a member-only account:** "You don't have a provider account yet. Register your business to get started." (button → `/get-started`).

## Switching apps (no second login)

- `POST /auth/handoff { target }` (signed in; needs a role for the target) returns a code of 32 random bytes, base64url.
  - It is valid **60 seconds** and works **once**. Only its SHA-256 is stored (`auth_handoff_codes`).
- The app navigates to `{other app}/auth/handoff?code=…`. That page:
  1. removes the code from the address bar;
  2. calls `POST /auth/handoff/exchange { code, target }` (public, throttled);
  3. receives a normal login response for *that* app.
- The exchange fails if the code is unknown, used, expired, for a different app, or if the user no longer holds the role.
- Tokens never appear in URLs.
- Sessions stay per-app: localStorage keys `suhana_*` on the member site and `aurora_providers_*` on the provider site. No cross-subdomain cookies.

## Migration

`1784334800000-add-user-account-roles` creates `user_account_roles` and `auth_handoff_codes`. It is idempotent, has a `down()`, and backfills:

- `MEMBER` for every `account_type = MEMBER` account;
- `PROVIDER` for `account_type = PROVIDER` accounts and for listing OWNERs;
- `PROVIDER_STAFF` for listing STAFF.

It never inserts or changes `user` rows.

## Tests

- `account-roles.service.spec.ts`: effective roles, idempotent grants, legacy members, and the handoff rules (hash-only, single use, expiry, wrong app).
- `jwt-auth.guard.provider.spec.ts`: member routes, opt-in routes, `AppRolesGuard`.
- `provider-portal.service.spec.ts`: account-duplication tests (existing email → 409 with no user created, onboarding reuses the account).
