#!/usr/bin/env node
/**
 * DEV-ONLY sample data for Aurora Discover. Never run against production.
 *
 *   node scripts/seed-discovery-dev.js            # (re)create the sample listings
 *   node scripts/seed-discovery-dev.js --remove   # delete them
 *
 * - Refuses unless NODE_ENV (from .env/.env.development) is "development" and DB_HOST is local.
 * - Every listing is named "Sample — …", created_by = 'dev-seed', and has NO reviews or
 *   ratings (ratings only ever come from approved member reviews).
 * - Adds a handful of APPROXIMATE postal-code centroids to geo_postal_codes so ZIP/PIN search
 *   works before the real GeoNames import. The real import replaces each country's rows.
 */
'use strict';

const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.development'), override: true });
const mysql = require(path.join(root, 'node_modules', 'mysql2', 'promise'));

const MARK = 'dev-seed';

if (process.env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  console.error('Refusing to run: this script only runs with NODE_ENV=development against a local database.');
  process.exit(1);
}

// Approximate centroids (dev only). country, postal, place, state, lat, lng
const GEO = [
  ['US', '10001', 'New York', 'New York', 'NY', 40.7506, -73.9971],
  ['US', '08817', 'Edison', 'New Jersey', 'NJ', 40.5168, -74.3912],
  ['US', '08820', 'Edison', 'New Jersey', 'NJ', 40.5779, -74.3667],
  ['US', '94538', 'Fremont', 'California', 'CA', 37.5265, -121.9653],
  ['US', '75038', 'Irving', 'Texas', 'TX', 32.8650, -96.9900],
  ['US', '77001', 'Houston', 'Texas', 'TX', 29.8131, -95.3098],
  ['IN', '600001', 'Chennai', 'Tamil Nadu', '25', 13.0878, 80.2785],
  ['IN', '600040', 'Chennai', 'Tamil Nadu', '25', 13.0850, 80.2101],
  ['IN', '641001', 'Coimbatore', 'Tamil Nadu', '25', 10.9950, 76.9610],
  ['IN', '560001', 'Bengaluru', 'Karnataka', '19', 12.9762, 77.6033],
  ['IN', '500001', 'Hyderabad', 'Telangana', '40', 17.3850, 78.4867],
  ['IN', '110001', 'New Delhi', 'Delhi', '07', 28.6328, 77.2197],
];

const geoOf = (country, postal) => {
  const g = GEO.find((r) => r[0] === country && r[1] === postal);
  if (!g) throw new Error(`no dev centroid for ${country} ${postal}`);
  return { city: g[2], state: g[3], lat: g[5], lng: g[6] };
};

const SAMPLES = [
  {
    name: 'Sample — Pandit Raghavan Iyer', business: 'Iyer Jyothisha Nilayam', status: 'VERIFIED', languages: ['ta', 'en', 'sa'],
    exp: 22, specs: ['kundli', 'horoscope-matching', 'muhurtham'],
    locs: [{ country: 'IN', postal: '600040', address: '12 2nd Avenue, Anna Nagar' }],
    services: [['Horoscope matching', 'horoscope-matching', 'IN_PERSON', 1500, 'INR', 60], ['Horoscope matching (video)', 'horoscope-matching', 'VIDEO', 1200, 'INR', 45]],
    certs: [{ name: 'Jyotisha Visharada', issuer: 'Sample Vidyapeeth', year: 2004, verified: false }],
  },
  {
    name: 'Sample — Jyotish Lakshmi Narayan', business: null, status: 'PENDING', languages: ['ta', 'ml'],
    exp: 12, specs: ['dosha', 'manglik'],
    locs: [{ country: 'IN', postal: '641001', address: null }],
    services: [['Dosha consultation', 'dosha', 'PHONE', 800, 'INR', 30]],
  },
  {
    name: 'Sample — Acharya Venkatesh Rao', business: 'Rao Astro Centre', status: 'VERIFIED', languages: ['kn', 'te', 'en'],
    exp: 30, specs: ['kundli', 'vastu', 'horoscope-matching'],
    locs: [{ country: 'IN', postal: '560001', address: '45 MG Road' }, { country: 'IN', postal: '600001', address: '8 Rajaji Salai', label: 'Chennai branch' }],
    services: [['Kundli reading', 'kundli', 'IN_PERSON', 2500, 'INR', 60], ['Vastu visit', 'vastu', 'IN_PERSON', 5000, 'INR', 120]],
  },
  {
    name: 'Sample — Pandit Suresh Sharma', business: null, status: 'PENDING', languages: ['hi', 'en', 'sa'],
    exp: 18, specs: ['kundli', 'manglik', 'numerology'],
    locs: [{ country: 'IN', postal: '110001', address: 'Connaught Place' }],
    services: [['Manglik dosha check', 'manglik', 'VIDEO', 2000, 'INR', 45]],
  },
  {
    name: 'Sample — Shastri Hari Prasad', business: null, status: 'PENDING', languages: ['te', 'hi'], accepting: false,
    exp: 8, specs: ['muhurtham', 'prashna'],
    locs: [{ country: 'IN', postal: '500001', address: null }],
    services: [['Muhurtham selection', 'muhurtham', 'PHONE', 600, 'INR', 30]],
  },
  {
    name: 'Sample — Pandit Krishna Bhat', business: 'Bhat Vedic Astrology', status: 'VERIFIED', languages: ['en', 'hi', 'kn'],
    exp: 25, specs: ['horoscope-matching', 'kundli'],
    locs: [{ country: 'US', postal: '08817', address: '100 Oak Tree Rd' }],
    services: [['Horoscope matching (video)', 'horoscope-matching', 'VIDEO', 75, 'USD', 45], ['Horoscope matching', 'horoscope-matching', 'IN_PERSON', 120, 'USD', 60]],
  },
  {
    name: 'Sample — Jyotishi Meena Subramanian', business: null, status: 'PENDING', languages: ['en', 'ta'],
    exp: 15, specs: ['horoscope-matching', 'dosha'],
    locs: [{ country: 'US', postal: '94538', address: '39000 Fremont Blvd' }],
    services: [['Dosha analysis', 'dosha', 'PHONE', 50, 'USD', 30]],
  },
  {
    name: 'Sample — Acharya Ravi Shankar', business: null, status: 'PENDING', languages: ['en', 'te', 'hi'],
    exp: 10, specs: ['muhurtham', 'vastu'],
    locs: [{ country: 'US', postal: '75038', address: '7 Las Colinas Blvd', showStreet: false }],
    services: [['Muhurtham consultation', 'muhurtham', 'VIDEO', null, null, 30]],
  },
  {
    name: 'Sample — Pandit Om Prakash (rejected)', business: null, status: 'REJECTED', languages: ['hi', 'en'],
    exp: 5, specs: ['kundli'],
    locs: [{ country: 'US', postal: '10001', address: '1 Sample St' }],
    services: [['Kundli reading', 'kundli', 'PHONE', 40, 'USD', 30]],
  },
];

// Non-astrologer samples: `specs` = category specialty codes, `attrs` = typed attributes
// (see src/modules/discovery/categories/category-definitions.ts).
const CATEGORY_SAMPLES = [
  // ── Marriage halls ───────────────────────────────────────────────────────
  {
    cat: 'marriage-hall', name: 'Sample — Sri Lakshmi Kalyana Mandapam', business: 'Sri Lakshmi Mahal', status: 'VERIFIED',
    languages: ['ta', 'en'], exp: 25, specs: ['kalyana-mandapam', 'banquet-hall'],
    attrs: { capacityMin: 300, capacityMax: 1200, roomsAvailable: 12, parking: true, airConditioned: true, inHouseCatering: true, outsideCateringAllowed: false },
    locs: [{ country: 'IN', postal: '600040', address: '22 Shanthi Colony Main Rd, Anna Nagar' }],
    services: [['Full-day hall rental', 'kalyana-mandapam', 'IN_PERSON', 150000, 'INR', null], ['Reception evening (6 hours)', 'banquet-hall', 'IN_PERSON', 85000, 'INR', 360]],
  },
  {
    cat: 'marriage-hall', name: 'Sample — Garden Pavilion Banquets', business: null, status: 'PENDING',
    languages: ['kn', 'en', 'hi'], exp: 10, specs: ['open-lawn', 'banquet-hall'],
    attrs: { capacityMin: 200, capacityMax: 800, parking: true, airConditioned: false, outsideCateringAllowed: true },
    locs: [{ country: 'IN', postal: '560001', address: '9 Cubbon Park Road' }],
    services: [['Lawn + hall package', 'open-lawn', 'IN_PERSON', 120000, 'INR', null]],
  },
  {
    cat: 'marriage-hall', name: 'Sample — Royal Oak Ballroom', business: 'Royal Oak Hotel', status: 'VERIFIED',
    languages: ['en', 'hi', 'gu'], exp: 18, specs: ['hotel-ballroom'],
    attrs: { capacityMin: 100, capacityMax: 450, roomsAvailable: 160, parking: true, airConditioned: true, inHouseCatering: true },
    locs: [{ country: 'US', postal: '08817', address: '250 Raritan Center Pkwy' }],
    services: [['Saturday ballroom package', 'hotel-ballroom', 'IN_PERSON', 9500, 'USD', 480]],
  },
  // ── Wedding planners ─────────────────────────────────────────────────────
  {
    cat: 'wedding-planner', name: 'Sample — Shubh Vivah Planners', business: 'Shubh Vivah Events Pvt Ltd', status: 'VERIFIED',
    languages: ['ta', 'te', 'en'], exp: 14, specs: ['full-planning', 'decor-design', 'vendor-management'],
    attrs: { eventsPlanned: 320, teamSize: 18, travelsForEvents: true },
    locs: [{ country: 'IN', postal: '600001', address: '4 Armenian Street, George Town' }],
    services: [['Full wedding planning', 'full-planning', 'IN_PERSON', 350000, 'INR', null], ['Day-of coordination', 'day-of-coordination', 'IN_PERSON', 60000, 'INR', null], ['Planning consultation', 'full-planning', 'VIDEO', 2000, 'INR', 45]],
  },
  {
    cat: 'wedding-planner', name: 'Sample — Mandap & More Events', business: null, status: 'PENDING',
    languages: ['en', 'hi', 'pa'], exp: 9, specs: ['destination-weddings', 'day-of-coordination', 'guest-management'],
    attrs: { eventsPlanned: 120, teamSize: 8, travelsForEvents: true },
    locs: [{ country: 'US', postal: '94538', address: '4000 Mowry Ave' }],
    services: [['Destination wedding planning', 'destination-weddings', 'IN_PERSON', 4500, 'USD', null], ['Discovery call', 'destination-weddings', 'VIDEO', null, null, 30]],
  },
  // ── Matrimonial consultants ──────────────────────────────────────────────
  {
    cat: 'matrimonial-consultant', name: 'Sample — Kalyan Vivaha Consultants', business: null, status: 'VERIFIED',
    languages: ['ta', 'te', 'en'], exp: 20, specs: ['community-matchmaking', 'horoscope-coordination', 'family-meetings'],
    attrs: { communitiesServed: 'Tamil and Telugu families', familyMeetingsArranged: true, confidentialService: true },
    locs: [{ country: 'IN', postal: '641001', address: '18 Oppanakara Street' }],
    services: [['Registration & personalised search', 'community-matchmaking', 'IN_PERSON', 15000, 'INR', 60], ['Introductory consultation', 'community-matchmaking', 'PHONE', 1500, 'INR', 30]],
  },
  {
    cat: 'matrimonial-consultant', name: 'Sample — NRI Rishta Connect', business: null, status: 'PENDING',
    languages: ['en', 'hi', 'pa', 'gu'], exp: 11, specs: ['nri-matches', 'professionals', 'background-verification'],
    attrs: { communitiesServed: 'Punjabi, Gujarati and Hindi-speaking families', confidentialService: true },
    locs: [{ country: 'US', postal: '10001', address: '350 5th Ave', showStreet: false }],
    services: [['NRI matchmaking consultation', 'nri-matches', 'VIDEO', 250, 'USD', 60]],
  },
  // ── Photography ──────────────────────────────────────────────────────────
  {
    cat: 'photography', name: 'Sample — Candid Moments Studio', business: null, status: 'VERIFIED',
    languages: ['ta', 'en'], exp: 12, specs: ['candid', 'cinematic-video', 'pre-wedding', 'drone'],
    attrs: { teamSize: 6, deliveryWeeks: 6, travelsForEvents: true },
    locs: [{ country: 'IN', postal: '600040', address: '7 3rd Main Road, Anna Nagar' }],
    services: [['Wedding day photo + film', 'cinematic-video', 'IN_PERSON', 180000, 'INR', null], ['Pre-wedding shoot', 'pre-wedding', 'IN_PERSON', 45000, 'INR', 240]],
  },
  {
    cat: 'photography', name: 'Sample — Golden Frame Photography', business: null, status: 'PENDING',
    languages: ['en', 'te'], exp: 8, specs: ['traditional', 'albums', 'live-streaming'],
    attrs: { teamSize: 3, deliveryWeeks: 8, travelsForEvents: false },
    locs: [{ country: 'US', postal: '75038', address: '600 E Las Colinas Blvd' }],
    services: [['Ceremony & reception coverage', 'traditional', 'IN_PERSON', 3200, 'USD', 600]],
  },
  {
    cat: 'photography', name: 'Sample — Hyderabad Lens Works', business: null, status: 'PENDING',
    languages: ['te', 'hi', 'en'], exp: 5, specs: ['candid', 'traditional', 'albums'],
    attrs: { teamSize: 4, deliveryWeeks: 5 },
    locs: [{ country: 'IN', postal: '500001', address: null }],
    services: [['Wedding photography package', 'candid', 'IN_PERSON', 90000, 'INR', null]],
  },
  // ── Catering & decoration ────────────────────────────────────────────────
  {
    cat: 'catering-decoration', name: 'Sample — Annapoorna Wedding Caterers', business: null, status: 'VERIFIED',
    languages: ['ta', 'ml', 'en'], exp: 30, specs: ['vegetarian', 'south-indian', 'live-counters'],
    attrs: { minGuests: 100, maxGuests: 3000, tastingAvailable: true },
    locs: [{ country: 'IN', postal: '641001', address: '55 Big Bazaar Street' }],
    services: [['Traditional banana-leaf meal (per plate)', 'south-indian', 'IN_PERSON', 650, 'INR', null], ['Live dosa counter', 'live-counters', 'IN_PERSON', 25000, 'INR', null]],
  },
  {
    cat: 'catering-decoration', name: 'Sample — Bloom & Light Decor', business: null, status: 'PENDING',
    languages: ['kn', 'en'], exp: 7, specs: ['floral-decor', 'stage-decor', 'lighting'],
    attrs: { minGuests: 50, maxGuests: 1500 },
    locs: [{ country: 'IN', postal: '560001', address: '31 Brigade Road' }],
    services: [['Mandap floral decoration', 'floral-decor', 'IN_PERSON', 120000, 'INR', null], ['Stage & lighting design', 'stage-decor', 'IN_PERSON', 80000, 'INR', null]],
  },
  {
    cat: 'catering-decoration', name: 'Sample — Spice Route Catering', business: null, status: 'VERIFIED',
    languages: ['en', 'hi', 'pa'], exp: 15, specs: ['north-indian', 'vegetarian', 'non-vegetarian'],
    attrs: { minGuests: 50, maxGuests: 800, tastingAvailable: true },
    locs: [{ country: 'US', postal: '77001', address: '1200 Main St' }],
    services: [['Wedding buffet (per guest)', 'north-indian', 'IN_PERSON', 38, 'USD', null]],
  },
  // ── Wedding shopping (shops; product catalogues are a later release) ────
  {
    cat: 'wedding-shopping', name: 'Sample — Thangam Jewellers', business: 'Thangam Jewellers & Sons', status: 'VERIFIED',
    languages: ['ta', 'en'], exp: 40, specs: ['jewellery', 'accessories'],
    attrs: { customOrders: true, alterations: true, homeTrial: false },
    locs: [{ country: 'IN', postal: '600001', address: '101 NSC Bose Road' }],
    services: [['Bridal jewellery consultation', 'jewellery', 'IN_PERSON', null, null, 60]],
  },
  {
    cat: 'wedding-shopping', name: 'Sample — Kanchi Silk House', business: null, status: 'PENDING',
    languages: ['ta', 'te', 'en'], exp: 22, specs: ['bridal-sarees'],
    attrs: { customOrders: true, homeTrial: true },
    locs: [{ country: 'IN', postal: '600040', address: '40 2nd Avenue, Anna Nagar' }],
    services: [['Bridal saree selection appointment', 'bridal-sarees', 'IN_PERSON', null, null, 90], ['Video shopping call', 'bridal-sarees', 'VIDEO', null, null, 45]],
  },
  {
    cat: 'wedding-shopping', name: 'Sample — Shaadi Couture', business: null, status: 'PENDING',
    languages: ['en', 'hi', 'gu'], exp: 9, specs: ['lehengas', 'sherwanis', 'accessories'],
    attrs: { customOrders: true, alterations: true },
    locs: [{ country: 'US', postal: '08820', address: '1655 Oak Tree Rd' }],
    services: [['Bridal lehenga fitting', 'lehengas', 'IN_PERSON', 150, 'USD', 60]],
  },
];

async function removeSamples(conn) {
  const [rows] = await conn.query('SELECT id FROM discovery_providers WHERE created_by = ?', [MARK]);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return 0;
  for (const t of ['discovery_locations', 'discovery_services', 'discovery_provider_languages', 'discovery_provider_categories',
    'discovery_provider_media', 'discovery_astrologer_details', 'discovery_service_details', 'discovery_favorites',
    'discovery_reviews']) {
    await conn.query(`DELETE FROM ${t} WHERE provider_id IN (?)`, [ids]);
  }
  await conn.query('DELETE FROM discovery_providers WHERE id IN (?)', [ids]);
  return ids.length;
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
  });
  try {
    await conn.beginTransaction();
    const removed = await removeSamples(conn);
    if (process.argv.includes('--remove')) {
      await conn.commit();
      console.log(`Removed ${removed} sample listings.`);
      return;
    }

    for (const g of GEO) {
      const [[exists]] = await conn.query('SELECT COUNT(*) AS n FROM geo_postal_codes WHERE country_code = ? AND postal_code = ?', [g[0], g[1]]);
      if (!Number(exists.n)) {
        await conn.query(
          'INSERT INTO geo_postal_codes (country_code, postal_code, place_name, admin_name1, admin_code1, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
          g,
        );
      }
    }

    const [catRows] = await conn.query('SELECT id, slug, name FROM discovery_categories');
    const catBySlug = new Map(catRows.map((c) => [c.slug, c]));
    if (!catBySlug.get('astrologer')) throw new Error('Run the API once (migrations) before seeding — discovery_categories is empty.');
    // Dev only: switch every category on so each Discover page can be exercised.
    await conn.query('UPDATE discovery_categories SET is_active = 1');

    const all = [...SAMPLES.map((s) => ({ ...s, cat: 'astrologer' })), ...CATEGORY_SAMPLES];
    for (const s of all) {
      const cat = catBySlug.get(s.cat);
      if (!cat) throw new Error(`Unknown category ${s.cat} — run the API (migrations) first.`);
      const id = crypto.randomUUID();
      const headline = s.cat === 'astrologer'
        ? `Vedic astrologer · ${s.exp} years`
        : `${cat.name.replace(/s$/, '')} · ${s.exp} years in business`;
      await conn.query(
        `INSERT INTO discovery_providers (id, display_name, business_name, headline, about, email, phone, website,
           verification_status, verified_at, is_active, accepting_clients, rating_count, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`,
        [
          id, s.name, s.business, headline,
          'DEV SAMPLE LISTING — not a real business. Created by scripts/seed-discovery-dev.js for local testing.',
          'sample@example.com', '+1 555 0100', 'https://example.com',
          s.status, s.status === 'VERIFIED' ? new Date() : null, s.accepting === false ? 0 : 1, MARK,
        ],
      );
      await conn.query('INSERT INTO discovery_provider_categories (provider_id, category_id, is_primary) VALUES (?, ?, 1)', [id, cat.id]);
      for (const lang of s.languages) {
        await conn.query('INSERT INTO discovery_provider_languages (provider_id, language_code) VALUES (?, ?)', [id, lang]);
      }
      for (const [i, l] of s.locs.entries()) {
        const g = geoOf(l.country, l.postal);
        await conn.query(
          `INSERT INTO discovery_locations (id, provider_id, label, address_line1, city, state, postal_code, country,
             latitude, longitude, show_street_address, is_primary, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [crypto.randomUUID(), id, l.label || null, l.address, g.city, g.state, l.postal, l.country, g.lat, g.lng,
            l.showStreet === false ? 0 : 1, i === 0 ? 1 : 0],
        );
      }
      for (const [i, sv] of s.services.entries()) {
        await conn.query(
          `INSERT INTO discovery_services (id, provider_id, category_id, name, specialization, consultation_mode, price, currency,
             duration_minutes, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [crypto.randomUUID(), id, cat.id, sv[0], sv[1], sv[2], sv[3], sv[4], sv[5], i],
        );
      }
      const hours = JSON.stringify(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => ({ day, open: '09:00', close: '18:00' })));
      if (s.cat === 'astrologer') {
        await conn.query(
          `INSERT INTO discovery_astrologer_details (provider_id, experience_years, specializations, business_hours, certifications)
           VALUES (?, ?, ?, ?, ?)`,
          [id, s.exp, JSON.stringify(s.specs), hours, JSON.stringify(s.certs || [])],
        );
      } else {
        await conn.query(
          `INSERT INTO discovery_service_details (provider_id, category_id, experience_years, specialties, attributes, business_hours, certifications)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, cat.id, s.exp, JSON.stringify(s.specs), JSON.stringify(s.attrs || {}), hours, JSON.stringify(s.certs || [])],
        );
      }
    }
    await conn.commit();
    const counts = all.reduce((m, s) => ({ ...m, [s.cat]: (m[s.cat] || 0) + 1 }), {});
    console.log(`Seeded ${all.length} sample listings (replaced ${removed}):`, counts);
    console.log('All Discover categories are now active in this dev database.');
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
