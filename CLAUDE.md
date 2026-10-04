# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**Aurora** is a matrimony (matchmaking) platform. This repo is its backend REST API. The codebase, package, GCP service and Docker images still use the original name **suhana** (`suhana-api`), so expect both names. Core features: rule-based and AI-assisted matchmaking, AI horoscope compatibility reports, natural-language profile search, interests/shortlists, in-app messaging, voice/photo profiles, an AI support chatbot, success stories/reviews, and premium tiers.

Members are either `bride` or `groom` (`Profile.gender`). Matching always pairs opposite genders.

## Commands

```bash
# Development
npm run start:dev        # Watch mode (NODE_ENV=development) — POSIX env syntax: run from Git Bash, not PowerShell/cmd
npm run start:debug      # Debugger + watch

# Build & Production
npm run build            # nest build → dist/ (copies src/assets)
npm run start:prod       # node dist/main

# Testing (Jest, rootDir = src, files: *.spec.ts)
npm run test                                         # All unit tests
npx jest src/modules/search/parsers                  # One folder
npx jest src/modules/audit/risk-scoring.engine.spec.ts   # One file
npx jest -t "parses religion"                        # By test name
npm run test:cov
npm run test:e2e         # test/*.e2e-spec.ts

# Code Quality
npm run lint             # ESLint with --fix
npm run format           # Prettier (singleQuote, trailingComma: all)
```

Local MySQL: `docker-compose up db` (exposes 3307). Swagger UI: `http://localhost:3000/api-docs`.

## Tech Stack

NestJS 10 · TypeScript (loose: `strictNullChecks: false`, `noImplicitAny: false`) · TypeORM 0.3 + MySQL 8 · Passport JWT · `@anthropic-ai/sdk` · `@nestjs/event-emitter` · `@nestjs/throttler` · Google Cloud Storage · `sharp` (images) · Nodemailer · Winston (console + daily-rotate file + DB `log` table) · `fuse.js` (fuzzy search) · `ioredis` (optional cache).

Imports use the `src/...` absolute path (e.g. `import { ResponseDto } from 'src/common/dto/response.dto'`). Jest maps it via `moduleNameMapper`.

## Request Lifecycle

`src/main.ts`:
1. `waitForDatabase()` blocks until MySQL is reachable.
2. Global prefix `api/v1`. Static assets from `src/assets` are served at `/static`.
3. Global `ValidationPipe({ transform: true })`. Note: **no `whitelist`**, so unknown properties pass through.
4. CORS: any origin, credentials allowed.
5. Socket timeout 120s. Swagger is mounted at `/api-docs` in both development and production.

Registered in `src/app.module.ts` (not `main.ts`):
- `APP_FILTER` → `AllExceptionsFilter`: logs the error and returns `{ statusCode, message, timestamp, path }`. When validation returns an array of messages, only the first one is returned.
- `APP_INTERCEPTOR` → `LoggingInterceptor`: logs `[METHOD] url - ms - user`. `/user/heartbeat` and `/email-history/notifications` are kept out of the DB log.
- `APP_INTERCEPTOR` → `AuditInterceptor`: acts on handlers marked with `@Audit()`.
- `EventEmitterModule.forRoot()`: the in-process event bus used for auditing.

`uncaughtException` and `unhandledRejection` call `process.exit(1)`. **An un-awaited promise that rejects will crash the server.**

## Auth & Authorization

**There is no global auth guard.** Each controller must opt in.

| Guard / decorator | Location | Use |
|---|---|---|
| `JwtAuthGuard` | `src/common/guards/jwt-auth.guard.ts` | Requires a Bearer JWT. Respects `@Public()`. |
| `RolesGuard` + `@Roles('admin')` | `src/common/guards/roles.guard.ts` | Role check. Needs `req.user`, so always put it after `JwtAuthGuard`: `@UseGuards(JwtAuthGuard, RolesGuard)` |
| `OptionalJwtAuthGuard` | `src/common/guards/optional-jwt-auth.guard.ts` | Public endpoint. Fills in `req.user` when a valid token is present. |
| `ThrottlerGuard` | chatbot only | 10 req/min, used on the guest chatbot |
| `@User()` / `@User('id')` | `src/common/decorators/user.decorator.ts` | Param decorator for `req.user` |

- `JwtStrategy` (`src/common/middleware/jwt.strategy.ts`) loads the user and sets `req.user = { id, email, firstName, lastName, role }`. Controllers read `req.user.id`.
- Roles live in the `roles` table (`User.role_id`). Enum `UserRole`: `user | admin | manager`. In practice only `'admin'` is checked.
- Login options (`src/modules/auth/`): email+password, passwordless email one-time code (`login/send-otc`, `login/validate-otc`), and mobile OTP (`mobile/*`). Refresh tokens go through `POST /token/refresh`. Password reset uses a 1h JWT with `type: 'password_reset'`.
- Mobile number verification lives in `src/modules/user/mobile-verification.*` and sends through `SmsService`.
- Swagger auth name is `'JWT-auth'`, so use `@ApiBearerAuth('JWT-auth')`.

## Module Map (`src/modules/`)

Typical layout: `x.module.ts`, `x.controller.ts`, `x.service.ts`, `entity/` (sometimes `entities/`), `dto/`, `enums/`. Larger modules add `services/`, `repositories/`, `controllers/`, `helpers/`.

| Module | Route prefix | Purpose |
|---|---|---|
| `auth` | `/auth`, `/token` | Register, login (password / email OTC / mobile OTP), email verification, password reset, login history, admin user management |
| `user` | `/User`, `/users/mobile`, `/admin/mobile-verification` | User CRUD, heartbeat/online status, block/report, membership/role changes, mobile verification. **Owns most core entities** (see below) |
| `profiles` | `/profiles` | Matrimony profile CRUD (`me`, by id, by `profileCode`), photos, horoscope document upload, voice intro, share profile by email. `admx/*` routes are for admins |
| `matches` | `/matches` | Match generation, rule-based scoring, AI explanations, **AI horoscope report** (`GET /matches/userx/:matchUserId`) |
| `shortlist` | `/shortlist` | Match pipeline status changes: shortlist → interest → connect / skip / reconsider |
| `interests` | `/interests` | Send/accept/decline interest (with email; `:interestId/accept/:guid` is the accept link sent by email) |
| `chat` | `/chat` | **User-to-user messaging**: conversations, messages, attachments (GCS), typing indicator (in-memory), icebreakers. Also `POST /chat/request`, a raw pass-through to Claude |
| `chatbot` | `/chatbot` | AI support assistant. Order: FAQ → knowledge base → cached answers → Claude. Guest endpoint `public/message` never calls the model. Admin knowledge CRUD and stats |
| `search` | `/search`, `/admin/search-analytics` | Natural-language profile search (details below), saved/recent/popular searches, similar profiles |
| `profile-visits` | `/profile-visits` | "Recently visited" and who-viewed-me. One row per (visitor, profile); repeat visits upsert |
| `personality` | `/personality` | Aurora Personality Assessment: 32 Likert questions, four-letter type, dimension scores, confidence, insights, pairwise compatibility. Scoring is a pure engine in `scoring/`; compatibility sits behind `PERSONALITY_COMPATIBILITY_PROVIDER` (rule-based by default). Question bank source: `seed/personality-question-bank.ts`. Exports `PersonalityService.getLatestCompletedAssessment()` for matchmaking |
| `premium` | `/premium` | Plans and subscribe. Tiers: `free`, `silver`, `gold`, `platinum` |
| `match-fixed` | `/profile/match-fixed`, `/match-fixed/public`, `/match-fixed/admin` | Members report a fixed match, partner verifies, admin approves → public success stories |
| `testimonials` | `/reviews`, `/success-stories` | Reviews with likes/replies/reports, sentiment analysis (pluggable `SENTIMENT_PROVIDER`, lexicon by default), admin moderation |
| `feedback` | `/feedback` | App and profile feedback with approve/reject/resolve/reply workflow |
| `image` | `/images` | Uploads with `sharp` variants: original 1200, display 600, thumbnail 250 (`config/image-size.config.ts`). `ImageContext` enum |
| `media` | `/profile/voice` | Voice introduction upload, audio metadata validation |
| `gallery` | `/gallery` | Profile gallery photos |
| `settings` | `/settings` | Notification/privacy settings, deactivate/delete account |
| `calls` | `/calls` | Call initiation and history (records only) |
| `admin` | `/admin` | Dashboard stats, user status, analytics, match-weight tuning |
| `audit` | `/audit-log`, `/admin/audit-log` | Event-driven audit log with risk scoring (details below) |
| `blog` | `/blog` | Posts, comments, likes, newsletter, Q&A |
| `lookup` | `/lookup` | Cities, occupations, education, value lists |
| `country` | `/countries` | Countries, states, districts |
| `contact`, `email-history`, `safety-tips`, `health`, `logger` | | Contact form, sent-email log/notifications, safety tips (admin CRUD + reorder), health check, `CustomLoggerService` |

### Core entities (`src/modules/user/entity/`, re-exported from `index.ts`)

Import them like this: `import { User, Profile, Match } from '../user/entity'`.

- **`User`** (`user`): auth/account data. Snake_case columns (`first_name`, `is_active` as a number, `role_id`, `membership`, `last_active`, `isMobileVerified` as a tinyint). Has an eager `OneToOne` to `Profile`.
- **`Profile`** (`profiles`): camelCase columns. Fields:
  - basics: `gender: 'bride'|'groom'`, `age`, `dateOfBirth`, `religion`, `caste`, `motherTongue`, `maritalStatus`
  - location and work: `city/state/country`, `educationLevel`, `occupationTitle`, `company`, `annualIncome`
  - family: `familyType`, `familyValues`
  - lists: `interests`, `lifestyleHabits` and `partnerExpectations` are `simple-array`
  - `preferences` (JSON: `ageRange`, `religions`, `castes`, `locations`…)
  - `horoscope` (JSON: `timeOfBirth`, `placeOfBirth`, `rashi`, `nakshatra`, `manglikStatus`), plus `horoscopeDocUrl`
  - media: `voiceIntroductionUrl`, `videoIntroUrl`
  - `profileCode` (unique, 9 chars, public identifier)
  - `profileStatus` (`ACTIVE | UNDER_DISCUSSION | MATCH_FIXED | MARRIED | PAUSED | DEACTIVATED`)
  - privacy flags: `photoPrivacy`, `isSearchable`, `acceptNewInterest`, `acceptNewChat`
  - `photos` is an eager relation to `ProfilePhoto`
- **`Match`** (`matches`): `userId → matchedUserId`, `matchPercentage`, `compatibilityBreakdown` (JSON), `badges`, `explanationText`, `status` (`suggested | shortlisted | interested | connected | skipped | reconsidered`), `currentStep`.
- **`Interest`** (`interests`, in the interests module): `fromUserId → toUserId`, status `pending | accepted | declined`, `guid`.
- **`UserSubscription`** (`tier`, `status: 'active'…`, `endDate`) and **`PremiumPlan`**.
- **`HoroscopeCompatibilityReport`**: cached AI report keyed by both users' birth details, `isActive` / `invalidatedAt`.
- **`Conversation` / `Message`**: for the chat module. Participant IDs are user IDs.
- Also: `ProfilePhoto`, `UserBlock`, `UserReport`, `MobileVerificationOtp`, `RefreshToken`, `PasswordArchive`, `Otc`.

IDs are UUID strings (`@PrimaryGeneratedColumn('uuid')`), except `roles.id`, which is an integer.

## AI / Claude Integration

The client is provided **per module** with a factory. Reuse this pattern in new modules:

```ts
{
  provide: Anthropic,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Anthropic({ apiKey: config.get<string>('CLAUDE_API_KEY') }),
}
```

(The `chat` module registers `Anthropic` as a bare provider and `shared/matches/matches.helper.ts` calls `new Anthropic()` directly. Both depend on `ANTHROPIC_API_KEY`, which is not set. Prefer the factory.)

| Use | Where | Model | Notes |
|---|---|---|---|
| Horoscope compatibility report | `matches.service.ts` → `analyzeHoroscopeCompatibility` | `claude-sonnet-4-5`, 8192 tokens | Prompts in `buildHoroscopePromptRegular` and `buildHoroscopePromptDocument`. Response is parsed as JSON after stripping code fences, falling back to `{ raw }` |
| Match explanation and badges | `matches.service.ts` → `enrichWithAI` | `claude-haiku-4-5`, 200 tokens | Rule-based scores are computed first and the AI only adds the explanation |
| Support chatbot | `chatbot/chatbot.service.ts` | `claude-sonnet-4-5`, 1000 tokens | System prompt in `chatbot/prompts/system-prompt.ts`; 10-message history |
| Chatbot profile-search intent | `chatbot/services/profile-search.service.ts` | `claude-haiku-4-5` | |
| Search intent fallback | `search/ai-fallback/claude-search-intent.service.ts` | `claude-haiku-4-5` | Bound through the `AI_INTENT_PROVIDER` token, so it can be swapped |
| Raw pass-through | `chat.controller.ts` `POST /chat/request` | `claude-sonnet-4-20250514`, 1000 tokens | Body `{ messages, system }` |

Model IDs are hard-coded constants in each file. When you add an AI feature, put the model in a named constant, use Haiku for cheap classification/extraction, keep Claude behind an interface/token when it may be swapped (see `AI_INTENT_PROVIDER`, `SENTIMENT_PROVIDER`, `PERSONALITY_COMPATIBILITY_PROVIDER`), and cache expensive results.

## Key Feature Flows

### Matchmaking (`matches` + `shared/matches/`)
- `generateMatches(userId)` selects opposite-gender candidates (`MAX_CANDIDATES = 4`) and scores each pair with `computeCompatibilityRules()` in `src/shared/matches/matches.helper.ts`. Scoring covers age gap, mother tongue, income, career/occupation/company tier, education/institution tier, location and family values. Lookup tables are in `src/modules/matches/matches-lookup.ts`.
- `enrichWithAI` adds the explanation and badges, then the result is saved to `matches`.
- `MatchesService.computeCompatibility` (with `randomScore`) is legacy random scoring used by `generateRandomMatches`. Don't build on it.
- Admin can tune weights through `GET/PATCH /admin/match-weights`.

### AI horoscope report (premium feature)
1. `getAIMatchesByUsers` requires an active `UserSubscription` with tier `gold` or `platinum` and an `endDate` that hasn't passed. Otherwise it throws `ForbiddenException`.
2. It looks up a cached `HoroscopeCompatibilityReport` (either user order, matching birth data, `isActive = true`). If none exists, it calls Claude and saves the result.
3. **Cache invalidation:** `MatchesService.handleProfileAuditEvent` listens with `@OnEvent(AUDIT_EVENT)` for `PROFILE_UPDATED` events where `horoscopeDocUrl` changed, and soft-invalidates every report involving that user.

### AI search (`search`): five levels, cheapest first
1. Cache (`SearchCacheService`): in memory, or Redis when `REDIS_HOST` is set.
2. Local parser: dictionaries, synonyms and fuzzy matching (`parsers/`, `dictionaries/`).
3. Claude fallback, only when local confidence is below `CONFIDENCE_THRESHOLD`.
4. SQL filtering in `SearchQueryBuilderService`.
5. In-memory ranking in `MatchRankingService`.

Every query is recorded in `search_history` for the admin analytics.

### Chatbot (`chatbot`)
- Answers come from the cheapest source that is confident enough: FAQ (≥ 0.9) → knowledge base (≥ 0.8) → a cached past answer (≥ 0.85) → Claude.
- Guests go through `GuestChatbotResolverService`. Personalised requests (`RESTRICTED_KEYWORDS`) get a login prompt.

### Match pipeline
`Match.status` moves `suggested → shortlisted (step 1) → interested (step 2) → connected (step 3)`. Moving to `interested` automatically sends an `Interest` (with email) when none exists. A fixed match goes through the `match-fixed` module and sets `Profile.profileStatus = MATCH_FIXED`.

## Cross-Cutting Services

- **Audit logging** (`src/modules/audit/`). Two ways to log:
  - Declarative: `@Audit({ eventType, entityType, entityIdFrom: 'params.id', captureBody? })` on a controller handler. It is logged only on a 2xx response.
  - Programmatic: inject `AuditEmitter` and call `emit({ eventType, entityType, entityId, userId, oldValue, newValue, changedFields })`. This is fire-and-forget. `ProfilesService` uses it to send before/after snapshots.

  Events are listed in `enums/audit-event-type.enum.ts`, and the values are stored verbatim, so don't rename them. `AuditLogListener` saves events with a risk level from `risk-scoring.engine.ts`. Other modules can react with `@OnEvent(AUDIT_EVENT)`.
- **Logging**: inject `CustomLoggerService` (from `LogModule`) and call `log/error/warn`. It writes to the console, rotating files in `/app/logs`, and the DB `log` table. Use `logWithoutDb` for noisy messages.
- **File storage**: `CloudStorageService` (`src/common/services/`) provides `uploadFile(file, folder)`, `uploadVoiceFile`, `deleteFile(url)` and `isFileValid(file)`, and returns public GCS URLs. Bucket: `GCP_BUCKET`. In development it authenticates with the key file `./starinvoice-*.json`; in production it uses ADC (Cloud Run service account). Uploads use multer `memoryStorage()`.
- **Email**: `EmailService.sendEmail()` (`src/shared/email/`), Nodemailer over SMTP. HTML templates are TS functions in `src/shared/email/templates/`. Sends are recorded through `email-history`.
- **SMS**: `SmsService.sendSms()` (`src/shared/sms/`). It is **log-only until `SMS_PROVIDER` is set**; the Twilio branch is stubbed. It never throws.
- **Encryption**: `EncryptionService` (`src/shared/services/`), crypto-js.
- `src/common/context/clinic-context.*` and `src/shared/utils/appointment-token.ts` are leftovers from an OpenDental/clinic template, as are the `OPENDENTAL_*` and `APPOINTMENT_*` env vars. They are unused by matrimony features.

## Conventions for New Features

1. **Scaffold**: `src/modules/<feature>/` with module, controller, service, `entity/`, `dto/`, `enums/`. Register the module in `AppModule.imports`.
2. **Entities**: use `TypeOrmModule.forFeature([...])` in the module. Entities are found by the glob `src/**/*.entity.ts` (`autoLoadEntities: false`), so the file name must end in `.entity.ts`. Reuse core entities from `../user/entity`.
3. **Migrations** (required for production, where synchronize is off): write them by hand in `src/database/migrations/<timestamp>-<kebab-name>.ts` with raw SQL `CREATE TABLE IF NOT EXISTS ...` and a `down()`. Recent files continue the sequence `1784334000000`, so use the next `…00000` step. They run at startup when `DB_MIGRATIONS_RUN=true`, and there is no CLI script. In development, `synchronize: true` changes the schema from entities automatically, and dev also has `DB_MIGRATIONS_RUN=true`, so sync runs first and migrations run after it. DDL must therefore be idempotent, and seed migrations should skip when the data already exists. Make sure the migration matches the entity exactly, including explicit index names (`@Index('IDX_…')`) and FK names (`@JoinColumn({ foreignKeyConstraintName })`).
4. **DTOs**: use `class-validator` and `@ApiProperty` on every field. List queries extend `PaginationQueryDto` (`page`, `limit ≤ 100`, `skip` getter) and return `PaginatedResult<T>` (`src/common/dto/pagination.dto.ts`).
5. **Responses**: new code should wrap results in `ResponseDto.success(data, msg)` / `.created` / `.updated` / `.deleted()` (`src/common/dto/response.dto.ts`). Older endpoints often return raw entities, so check what the frontend expects for the area you're changing. Throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`…) and let `AllExceptionsFilter` format them.
6. **Controllers**: add `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth('JWT-auth')`, explicit guards, and `@Roles('admin')` for admin routes. Admin routes usually get their own `*-admin.controller.ts` with an `admin/...` prefix.
7. **Premium gating**: check `UserSubscription` (`status: 'active'`, tier in a `Set`, `endDate` not passed), as in `MatchesService.getAIMatchesByUsers`.
8. **Side effects** (audit, cache invalidation, notifications): emit events rather than calling across modules directly. Wrap listeners in try/catch, because a failure must never fail the original request.
9. **Pluggable providers**: put external or AI dependencies behind an interface plus a `Symbol` injection token.
10. **Tests**: put `*.spec.ts` next to the code and use `@nestjs/testing` with mocked repositories (see `audit-log.service.spec.ts`, `search-intent-parser.service.spec.ts`).

## Environment Variables

Files: `.env` (always loaded) plus `.env.<NODE_ENV>` (not loaded in production, where Cloud Run env vars apply). Config sections are registered in `src/config/configuration.ts`: `database`, `jwt`, `admin`, `smtp`, `googleCloud`. Much code reads `process.env` directly.

```
NODE_ENV, PORT
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_MIGRATIONS_RUN
JWT_SECRET, JWT_EXPIRES_IN
CLAUDE_API_KEY                         # Anthropic — read via ConfigService in module factories
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, ADMIN_EMAIL, CC_EMAIL
GCP_BUCKET (+ GOOGLE_CLOUD_* for StorageService)
FRONTEND_URL                           # Links in emails (share profile, verify, reset)
ENCRYPTION_KEY, ENCRYPTION_SECRET_KEY
REDIS_HOST, REDIS_PORT, REDIS_PASSWORD # Optional — search cache
SMS_PROVIDER (+ TWILIO_*)              # Optional — SMS is log-only when unset
```

## Deployment

`cloudbuild.yaml` builds `gcr.io/$PROJECT_ID/suhana-api` from `Dockerfile` and deploys it to **Cloud Run** (`us-central1`). Only DB vars and `NODE_ENV` are passed through `--set-env-vars`; everything else must be configured on the service (`service.yaml`). `Dockerfile.prod` is a multi-stage build on node:22-alpine. `docker-compose.yml` provides local MySQL only.

## Gotchas

- Mixed column naming: `User` uses snake_case, while `Profile` and newer entities use camelCase properties (often with explicit snake_case `name:`). Follow the convention of the entity you're editing.
- `User.is_active` is a number (`1`/`0`), not a boolean. Queries use `user: { is_active: 1 }`.
- `User → Profile` and `Profile → photos` are **eager**. Watch out for payload size and N+1 queries in list endpoints.
- Without `whitelist` on `ValidationPipe`, `Object.assign(entity, dto)` patterns can overwrite unexpected columns. Pick fields explicitly in new code.
- `ChatService.typingState` and the default search cache are in-memory per instance. They are not shared across Cloud Run instances.
- Never commit or print the GCP service-account JSON in the repo root or the values in `.env*`.
