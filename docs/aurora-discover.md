# Aurora Discover

A directory of local wedding-related services, organised by category, for the **United States and India**. All seven categories have member pages: astrologers (Phase 1), marriage halls, wedding planners, matrimonial consultants, photography, catering & decoration, and wedding shopping. Wedding shopping lists **shops**; a product catalogue would be its own data model in a later release.

- Module: `src/modules/discovery/`
- Migration: `src/database/migrations/1784334500000-add-aurora-discover.ts`
- Frontend: `suhana/src/app/features/discover/`, mounted at `/discover` (member-only, never indexed)

---

## 1. Architecture

```
DiscoveryController (members, JWT)          AdminDiscoveryController (JWT + role admin)
        │                                              │
        ├─ DiscoveryCatalogService (categories) ◄──────┤
        ├─ DiscoverySearchService ──► buildProviderSearchSql()   (pure, unit-tested)
        │        │                        ▲
        │        ├─ LocationResolverService ─► GEOCODING_PROVIDER (GeoNames table by default)
        │        └─ CategoryHandlerRegistry ─► AstrologerCategoryHandler | GenericCategoryHandler
        ├─ ProviderPresenterService (entity → card/detail DTOs; shared by search, detail and favorites)
        ├─ DiscoveryFavoritesService
        └─ DiscoveryReviewsService ◄────────────────────┤
                                     DiscoveryAdminService (CRUD, verification, locations, media)
```

**Shared engine vs. category-specific code.** The parts every category shares are generic: locations, services and fees, languages, favorites, reviews, verification, distance search, and sorting. Anything specific to one category sits behind `CategoryHandler` (`categories/category-handler.ts`). A handler supplies four things:
- extra SQL for search (joins, filters, and the expression used to sort by experience);
- the sorts the category supports;
- how to load its detail table and map it into the card and detail DTOs;
- how to save the admin input for its detail table.

**Category handlers today:** `AstrologerCategoryHandler` (own table) and one `ConfigurableCategoryHandler` per entry in `CATEGORY_DEFINITIONS` (specialty codes, typed attributes, optional capacity attribute used by `minCapacity`). Specialty codes are validated per category (unknown → 400).

To add a category:
1. Activate its row in `discovery_categories` (from the admin Categories tab, or SQL).
2. Add an entry to `CATEGORY_DEFINITIONS` (specialties + typed attributes). Only a category with truly different structure needs its own table and handler.
3. Add the matching entry to the frontend `features/discover/utils/category-config.ts` (segment, copy, image, labels). The search, detail, home tile and admin fields follow automatically.

**Products stay separate.** `discovery_categories.kind = 'PRODUCT'` marks wedding shopping. Products are not service providers: they need their own tables (catalogue, SKUs, merchants) in a later release. No checkout is planned in Discover.

**Monetisation stays separate.** "Recommended" ranking has no paid factor (see §5). Featured or sponsored results will be a separate, labelled slot added in a later release, not a ranking weight.

## 2. Schema (migration `1784334500000`)

All tables follow the personality/profile_visits convention: no database-level foreign keys, and integrity is enforced in the service layer. The migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`), has a `down()`, and was checked against the entities in a scratch schema: after the migration ran, TypeORM's schema builder reported **0 pending sync queries**.

| Table | Purpose |
|---|---|
| `discovery_categories` | Columns: slug (unique), name, description, parent_id, kind (`SERVICE`/`PRODUCT`), icon, image_url, is_active, display_order. Seeded with `astrologer` active; the other six categories are inactive and show as "coming soon". |
| `discovery_providers` | `user_id` is nullable (listings are admin-managed). Also holds `verification_status` (`PENDING`/`VERIFIED`/`REJECTED`/`SUSPENDED`), notes, verified_at/by, is_active, accepting_clients, `rating_avg`/`rating_count` (calculated from APPROVED reviews only), and soft delete (`deleted_at`). |
| `discovery_provider_categories` | Many-to-many link between providers and categories, with `is_primary`. |
| `discovery_locations` | Several per provider. Holds address lines, city, state, `postal_code` (a string), `country` (ISO alpha-2), `latitude`/`longitude` as `decimal(9,6)` (nullable), `show_street_address`, is_primary, is_active. Indexed on `(latitude, longitude)` and `(country, state, city)`. |
| `discovery_services` | Specialization, `consultation_mode` (`IN_PERSON`/`PHONE`/`VIDEO`), price (NULL means "on request"), currency, duration. No payments. |
| `discovery_provider_languages` | ISO 639 codes. |
| `discovery_provider_media` | Gallery images stored in GCS under `discovery/providers/<id>/`. |
| `discovery_service_details` | Details for every non-astrologer category, one row per (provider, category): experience_years, `specialties` (JSON codes), `attributes` (JSON, **typed per category** by `categories/category-definitions.ts` and sanitised on every write — unknown keys dropped), business_hours, certifications, availability_note. Migration `1784334600000`. |
| `discovery_astrologer_details` | The astrologer detail table: experience_years, specializations (JSON codes), business_hours (JSON), certifications (JSON, each with its own `verified` flag), availability_note. |
| `discovery_favorites` | Unique on `(user_id, provider_id)`. |
| `discovery_reviews` | Unique on `(provider_id, user_id)`. Has `status` (`PENDING`/`APPROVED`/`REJECTED`/`HIDDEN`) and moderation fields. |
| `geo_postal_codes` | GeoNames postal-code centroids used for ZIP, PIN and city geocoding (§4). |

Appointment requests are **not** built in Phase 1. They were optional, and with admin-managed listings there's no provider to receive them. See §10.

## 3. Endpoints (prefix `api/v1`)

### Members (`JwtAuthGuard`; rate-limited per member via `MemberThrottlerGuard`)
| Method | Path | Notes |
|---|---|---|
| GET | `discovery/categories` | All categories; `isActive=false` means "coming soon". |
| GET | `discovery/categories/:slug` | |
| GET | `discovery/astrologers` | Search; 60 requests/min. Query parameters are listed below. |
| GET | `discovery/astrologers/:id` | Profile. Takes the same optional location parameters, so the distance shown matches the list. |
| GET | `discovery/providers?category=<slug>` | Generic search for later categories. An inactive category returns 404 `CATEGORY_COMING_SOON`. |
| GET | `discovery/providers/:id` | Optional `category=<slug>`: returns that category's details (`serviceDetail`) and 404s if the listing isn't in it. Cards carry a uniform `details` block (experience, specialties, typed attributes) for every category. |
| POST | `discovery/providers/:id/contact` | Returns phone, email and website; 15 requests/min. Contact details never appear in search results, to make scraping harder. |
| GET | `discovery/providers/:id/reviews` | APPROVED reviews, plus the caller's own review in any status. |
| POST | `discovery/providers/:id/reviews` | One review per member per listing; starts PENDING; 5 requests/min. |
| GET / POST / DELETE | `discovery/favorites[/:providerId]` | Always scoped to `req.user.id`. Add and remove are idempotent. |

**Search query parameters:**
- Location: `country` (US\|IN), `postalCode`, `city`, `state`, `lat`, `lng`.
- Distance: `radius` (5\|10\|25\|50\|100\|all, default 25) and `unit` (mi\|km; defaults to mi for the US and km for India).
- Filters: `language`, `consultationMode`, `specialization` (the category's specialty codes; comma-separated or repeated), `minRating`, `minExperience`, `minCapacity` (marriage halls → `capacityMax`, catering → `maxGuests`), `minPrice`, `maxPrice`, `verifiedOnly`, and `q` (name).
- Sorting and paging: `sortBy` (recommended\|nearest\|rating\|experience\|price_asc\|price_desc), `page`, `limit` (≤50).

The response includes `origin` (where the search was centred, the unit, and the radius actually applied) and `ranking`:
- `requested` and `applied` sort;
- a plain-language `description` of the order;
- the factor weights, when the applied sort is "recommended";
- a `notice` when the server fell back to a different sort.

### Admin (`JwtAuthGuard + RolesGuard + @Roles('admin')`; every write is audited)
| Method | Path |
|---|---|
| GET / PATCH | `admin/discovery/categories[/:id]` |
| GET / POST | `admin/discovery/providers` (filters: `q`, `category`, `status`, `country`, `includeDeleted`) |
| GET / PATCH / DELETE | `admin/discovery/providers/:id` (DELETE is a soft delete) |
| POST | `admin/discovery/providers/:id/restore` |
| PATCH | `admin/discovery/providers/:id/verification` `{ status, notes }` (REJECTED and SUSPENDED require notes) |
| POST / PATCH / DELETE | `admin/discovery/providers/:id/locations[/:locationId]` (geocoded server-side) |
| POST / DELETE | `admin/discovery/providers/:id/media[/:mediaId]` (multipart `file`, `caption`, `setAsPhoto`) |
| GET | `admin/discovery/geocode?country&postalCode|city&state` |
| GET / PATCH | `admin/discovery/reviews[/:id]` (moderation recalculates the listing's rating) |

Audit events (`AuditEventType`): `DISCOVERY_PROVIDER_{CREATED,UPDATED,DELETED,RESTORED,VERIFICATION_CHANGED}`, `DISCOVERY_LOCATION_{ADDED,UPDATED,DELETED}`, `DISCOVERY_MEDIA_{ADDED,DELETED}`, `DISCOVERY_CATEGORY_UPDATED`, `DISCOVERY_REVIEW_{SUBMITTED,MODERATED}`.

Rate limiting uses the global `ThrottlerModule` that `ChatbotModule` registers (its storage and options). If that registration ever moves, keep a global `ThrottlerModule.forRoot` somewhere, or `MemberThrottlerGuard` will fail to resolve.

## 4. Location search

**Resolving the origin** (`geo/location-resolver.service.ts`):
1. **Device location.** `lat`/`lng` are sent only after the member clicks "Use my location". The server rounds them to 2 decimal places (≈1.1 km). They are never stored or echoed back, and the frontend keeps them in memory only, never in the URL.
2. **ZIP / PIN.** The format is validated: US is `^\d{5}(-\d{4})?$` (looked up by the first 5 digits); India is `^[1-9]\d{5}$`. If no country is given, it's inferred from the shape. The code is then looked up in `geo_postal_codes`, averaging the matching rows (an Indian PIN can cover several post offices). A malformed code returns 400 `INVALID_POSTAL_CODE`; a well-formed but unknown one returns 400 `POSTAL_CODE_NOT_FOUND`. Both carry a readable message.
3. **City (+ optional state) + country.** Resolved to a centroid from `geo_postal_codes`. If the city isn't in the table, the search falls back to matching the city text on listings, without distances.
4. **State + country, or country only.** A text filter on the listing's location. No distances are calculated, and `radius` is ignored.
5. **Nothing given.** Searches the whole directory.

**Query** (`search/provider-search.query.ts`, a pure function):
- An **inner** query filters on:
  - an indexed bounding box (`l.latitude BETWEEN … AND l.longitude BETWEEN …`, using `IDX_DISCOVERY_LOCATIONS_GEO`);
  - category, status and visibility;
  - the facets, via `EXISTS` subqueries.

  It then groups by provider so a provider with several locations appears once, at the distance of its nearest location (`MIN(haversine)`), and applies `HAVING distance_km <= radius`.
- An **outer** query calculates the "recommended" score, sorts with stable tie-breakers (`display_name`, `id`), and paginates with `LIMIT/OFFSET` in SQL. A separate `COUNT(*)` over the same inner query returns the total. **No provider list is ever loaded into memory**: only one page of ids is read, then that page is loaded with its relations.
- When the box would cross the antimeridian or a pole, the longitude filter is dropped and Haversine still makes the exact cut.

**Why a bounding box plus Haversine, rather than MySQL spatial?** The server runs MySQL 8.0.46, whose `SPATIAL` indexes on SRID-4326 `POINT` columns do work. But `ST_Distance_Sphere` can't use them: the index helps only with an `MBRContains`/`ST_Within` polygon, which ends up as the same bounding-box prefilter. The B-tree approach gives:
- the same index behaviour at directory scale;
- nullable coordinates (a listing that hasn't been geocoded yet);
- schema that is portable and works with `synchronize`;
- SQL that is easy to unit-test.

If the directory grows to hundreds of thousands of locations, reconsider a `POINT SRID 4326` column with an `ST_Buffer`/`MBRContains` prefilter.

**Units.** The radius is converted to km for SQL (1 mi = 1.609344 km); displayed distances are converted back and rounded to 0.1. Fees are compared as numbers, so fee filters require a country. A fee sort without a country falls back to "recommended" with a notice.

**Privacy.** A member's location is never stored. Listings flagged `show_street_address = false` (for example, home-based astrologers) expose only city and state: no street address, postal code, coordinates or directions link. Provider coordinates are never returned to members. "Directions" opens a Google Maps URL built from the public address only (`https://www.google.com/maps/dir/?api=1&destination=…`, no API key). The member's maps app supplies the starting point; we never send it.

## 5. Ranking (transparent)

The sorts are `recommended`, `nearest`, `rating`, `experience`, `price_asc` and `price_desc`. Listings with no value for the sort field (for example, no published fee) go last. Ties are broken by name, then id. **No listing is ever labelled "best".**

"Recommended" weights (`search/ranking.ts`, returned in every response):

| Factor | Weight | Definition |
|---|---|---|
| Distance | 0.30 | 1 at the centre, falling linearly to 0 at the radius (100 km when the radius is "all"). Neutral 0.5 when no location is given. |
| Rating | 0.25 | Bayesian average of APPROVED reviews (prior: 3.5★, weighted as 5 reviews) ÷ 5, so one 5★ review can't dominate. |
| Review count | 0.10 | log10(1 + n) / 2, capped at 1. |
| Experience | 0.15 | years / 30, capped at 1. |
| Verification | 0.15 | 1 if the listing is VERIFIED. |
| Availability | 0.05 | 1 if accepting new clients. |

## 6. Trust rules (enforced in code)

- A "Verified listing" badge is shown **only** when `verification_status = VERIFIED`. It covers the business listing (identity and contact details checked by an admin), not qualifications. Each certification has its own `verified` flag, which the UI shows as "Credential checked by Aurora" or "As stated by the provider".
- REJECTED and SUSPENDED listings are hidden from members. PENDING listings are visible without a badge.
- Ratings come only from APPROVED reviews and are recalculated on every moderation decision. Nothing is seeded or invented.
- No sample providers exist in production. `scripts/seed-discovery-dev.js` refuses to run unless `NODE_ENV=development` and the database host is local. It seeds 25 listings across all seven categories (2–9 each) and **switches every category on in that dev database**. Every sample is named "Sample — …", marked `created_by='dev-seed'`, and has no reviews. To remove them: `node scripts/seed-discovery-dev.js --remove` (category switches stay as they are).

## 7. Geocoding data (setup / deployment)

**Choice: a local table seeded from GeoNames** (CC BY 4.0), rather than a hosted geocoding API:
- no API key or secret to manage;
- no per-request cost or network dependency in the search path;
- deterministic, so it's easy to test;
- good enough for postal-code and city centroids, which is all a "near me" radius needs.

`GEOCODING_PROVIDER` is an injection token, so a hosted geocoder (Google, Mapbox) can be bound later with its key from env or Secret Manager.

**Import** (once per environment; re-run any time, since each country is replaced inside a transaction):
```bash
# download and unzip (≈2 MB + ≈7 MB)
curl -LO https://download.geonames.org/export/zip/US.zip && unzip US.zip US.txt
curl -LO https://download.geonames.org/export/zip/IN.zip && unzip IN.zip IN.txt
# load (DB settings from .env / .env.<NODE_ENV> or the process environment)
node scripts/import-geonames-postal-codes.js ./US.txt ./IN.txt
```
For production (Cloud Run + Cloud SQL), run the script from a machine that can reach the production database, with `NODE_ENV=production` and the `DB_*` variables set. The migration must have run first, since the API runs migrations at startup when `DB_MIGRATIONS_RUN=true`.

**Attribution:** GeoNames postal data is CC BY 4.0. Credit "GeoNames (geonames.org)" on an attributions or about page before launch.

Until the import is done, ZIP, PIN and city searches return "not found" (or fall back to city text). State and country searches, and admin listings with manually entered coordinates, still work.

**Environment variables:** none new. Uploads reuse `GCP_BUCKET` via `CloudStorageService`.

## 8. Map view

**Not built.** A map would need a tile or JS provider (Google Maps, Mapbox, or OpenStreetMap tiles with Leaflet) whose key belongs in configuration, and it would mean deciding how to show approximate locations for listings that hide their street address. This is a follow-up; the list view and the "Directions" links work without it.

## 9. Tests

`npx jest src/modules/discovery` runs 9 suites (117 tests), including `configurable-category.handler.spec` (registry coverage, per-category SQL, specialty validation, typed-attribute sanitising):
- `geo.util.spec`: Haversine, bounding box (antimeridian/pole), mi↔km conversion, coordinate coarsening.
- `location-resolver.service.spec`: US ZIP, ZIP+4, India PIN, inferred country, malformed and unknown codes, unsupported country, city → point, unknown city → area, state, country, device location rounded.
- `provider-search.query.spec`: placeholder and parameter parity across combinations; radius box and HAVING; "all" radius; area filters; hidden statuses; each facet; category fragment ordering; every sort's ORDER BY; weights sum to 1 with no paid factor; SQL pagination.
- `discovery-search.service.spec`: ZIP/PIN/city/state searches, unit defaults and switching, radius "all", no results, invalid code, astrologer filters, fee filter needing a country, every sort (and fallbacks), pagination, coming-soon category, details (visible, hidden, wrong category), contact.
- `discovery-favorites.service.spec`: add (idempotent, concurrent duplicate, hidden listing), remove scoped to the caller (IDOR), list pagination.
- `discovery-reviews.service.spec`: PENDING on create, one review per member, no self-review, public list shows APPROVED only, moderation recalculates the rating, rating cleared when no reviews are approved.
- `discovery-admin.service.spec`: verification workflow (stamps, required notes, suspend clears the badge, 404), soft delete audited, coordinate resolution order.
- `discovery-authorization.spec`: members are refused on every admin write, admins are allowed, and the guard metadata is in place.

The search SQL was also run against the dev MySQL with the dev sample listings. That run covered PIN, ZIP and ZIP+4, city, unknown city, state, country, device location, filters, every sort and pagination, and REJECTED listings were confirmed hidden.

## 10. Provider portal ("For Providers") and listing ownership

Migration `1784334700000-add-discovery-provider-portal`. Frontend: `suhana/src/app/features/provider-portal/` (routes `/providers`, `/providers/register`, `/providers/login`, `/providers/dashboard`, `/providers/claim`).

**One identity, separate entry points.** Providers use the same `user` table, password login, JWT and email verification as members. There is no second auth system:
- `user.account_type`: `MEMBER` (default, every existing account) or `PROVIDER` (registered via "For Providers").
- `user.gender` is now NULLable; only provider-only accounts leave it empty. Members still always have it.
- Permission over a listing comes from **`discovery_provider_members`** (`OWNER` / `STAFF` per listing), not a global role. That lets one person be a bride/groom member *and* own a business on a single login. Admins never need a membership row.

**Listing ownership** (columns on `discovery_providers`; existing rows keep today's behaviour):

| Column | Values | Default for existing / admin-created |
|---|---|---|
| `management_type` | `ADMIN_MANAGED`, `PROVIDER_MANAGED` | `ADMIN_MANAGED` |
| `listing_status` | `DRAFT`, `SUBMITTED`, `CHANGES_REQUESTED`, `PUBLISHED` | `PUBLISHED` |
| `review_note` | admin → provider message | null |
| `submitted_at` | when last submitted | null |

The other ownership fields were deliberately not duplicated:
- `created_by` already records who created the listing.
- `user_id` already holds the primary owner.
- The claim status is derived from `discovery_listing_claims`.

**Only `PUBLISHED` listings are public** (search SQL and `isProviderVisible`), on top of the existing active / not-deleted / not-rejected-or-suspended rules.

**Flows**
- **Admin create/edit (unchanged).** Admin-created listings are `ADMIN_MANAGED` and `PUBLISHED` immediately; no provider account is needed. Admins can edit, verify, suspend, delete and restore every listing, whatever its management type.
- **Provider registration** (`POST provider-portal/register`, public, 5 requests/min):
  - Creates an unverified `PROVIDER` account and a `DRAFT` listing it owns.
  - Emails a verification link to `{FRONTEND_URL or Origin}/providers/auth/verifyemail/:id/:code`. The existing verify-email template and endpoint are reused.
  - An email that already has an account (a member included) gets a 409 telling them to sign in and add the business from the dashboard instead.
- **Building a listing.** The provider edits it through `provider-portal/listings/:id` (same form as the admin editor). The service rejects changes a provider isn't allowed to make:
  - `isActive` is dropped;
  - certifications can't be self-verified (flags an admin already set survive unchanged entries);
  - the listing photo must be one of the listing's own uploads.
- **Submitting.** `POST …/submit` requires a category, a location, a description of 40+ characters and one contact method; it moves the listing to `SUBMITTED`.
- **Admin review** (`POST admin/discovery/providers/:id/review`):
  - `PUBLISH` → `PUBLISHED`;
  - `REQUEST_CHANGES` (note required) → `CHANGES_REQUESTED`;
  - `REJECT` (note required) → `CHANGES_REQUESTED` with verification `REJECTED`.

  Published provider listings can keep being edited and changes go live at once (see follow-ups).
- **Claim this business.**
  - **Request.** `POST provider-portal/claims` targets a published, `ADMIN_MANAGED` listing with no owner. It is pending only and grants **no access**.
  - **Approve.** `PATCH admin/discovery/claims/:id` with `APPROVED` makes the claimant `OWNER` and the listing `PROVIDER_MANAGED`, and auto-rejects competing claims.
  - **Reject.** Needs a note; the listing doesn't change.
  - **Member link.** Member detail responses carry `claimable` to show the "Claim this listing" link.
- **Admin control** (`POST admin/discovery/providers/:id/management`):
  - `ADMIN_MANAGED` takes the listing over and removes all provider access.
  - `PROVIDER_MANAGED` + `ownerEmail` assigns a verified account as owner.

**Security**
- **Ownership checks.** Every `provider-portal/listings/:id…` call goes through `DiscoveryOwnershipService.assertCanManage` (403 otherwise), so a provider can never touch another provider's listing.
- **Admin-only endpoints.** Review, claims and management stay behind `JwtAuthGuard + RolesGuard + @Roles('admin')`.
- **Audit.** New events: `DISCOVERY_PROVIDER_ACCOUNT_CREATED`, `DISCOVERY_LISTING_SUBMITTED`, `DISCOVERY_LISTING_REVIEWED`, `DISCOVERY_CLAIM_SUBMITTED`, `DISCOVERY_CLAIM_DECIDED`, `DISCOVERY_MANAGEMENT_CHANGED`.

**Verified:**
- Unit specs: `discovery-ownership.service.spec`, `provider-portal.service.spec`, and the authorization spec extended to the new endpoints. All 147 Discover tests pass.
- An end-to-end run of the real services against dev MySQL passed 18/18 checks: register, draft hidden, submit, publish, ZIP search, IDOR 403, claim, approve, take over, and the unchanged admin create path.

## 11. Follow-ups

- **Provider portal next steps**:
  - Staff invitations (the `STAFF` role exists in the schema and guards, but there's no UI yet).
  - Mobile verification for provider accounts.
  - Email notifications to providers and admins on submit, review and claim decisions (today they see it on their dashboard / admin tabs).
  - Optional re-review of edits to already-published provider listings.
  - Enquiries, appointments and analytics (shown as "Coming soon" on the dashboard).
- **Appointment requests**: the statuses were spec'd as pending/confirmed/declined/rescheduled/cancelled/completed. Providers can now own listings, so requests have someone to go to.
- **Review eligibility**: today any member can submit one moderated review per listing. Tie this to completed appointments once those exist, and mark those reviews as "verified consultation".
- **Map view** (§8). Optional location autocomplete in the search box, using `geo_postal_codes`.
- **Next categories**: marriage halls (capacity, venue type), photographers (portfolio), and the other handlers, then products for wedding shopping.
- **Monetisation**: a featured or sponsored slot kept separate from organic ranking, always labelled.
- **GeoNames attribution** on the site, and a scheduled re-import (GeoNames updates its data periodically).
