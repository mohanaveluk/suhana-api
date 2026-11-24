#!/usr/bin/env node
/**
 * Imports GeoNames postal-code centroids into `geo_postal_codes` (Aurora Discover geocoding).
 *
 * Data: https://download.geonames.org/export/zip/  (CC BY 4.0 — attribution required, see docs/aurora-discover.md)
 *   US.zip → US.txt   (≈41k US ZIP codes)
 *   IN.zip → IN.txt   (≈155k India post offices / PIN codes)
 * Unzip first; pass the .txt file(s). Columns (tab-separated):
 *   country, postal code, place name, admin name1, admin code1, admin name2, admin code2,
 *   admin name3, admin code3, latitude, longitude, accuracy
 *
 * Usage (from the repo root; DB settings come from .env + .env.<NODE_ENV>, or the process env):
 *   node scripts/import-geonames-postal-codes.js ./data/geonames/US.txt ./data/geonames/IN.txt
 *   NODE_ENV=production node scripts/import-geonames-postal-codes.js /tmp/IN.txt
 *
 * Each file's country is REPLACED inside one transaction (delete that country's rows, then insert),
 * so re-running is safe and the table never holds half an import. Requires the migration
 * 1784334500000-add-aurora-discover to have created the table.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(root, '.env') });
if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(root, `.env.${process.env.NODE_ENV}`), override: true });
}
const mysql = require(path.join(root, 'node_modules', 'mysql2', 'promise'));

const SUPPORTED = new Set(['US', 'IN']);
const BATCH = 2000;

const clip = (v, n) => (v === undefined || v === null || v === '' ? null : String(v).slice(0, n));

async function importFile(conn, file) {
  const rows = [];
  const countries = new Set();
  let skipped = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const c = line.split('\t');
    const country = (c[0] || '').trim().toUpperCase();
    const postal = (c[1] || '').trim();
    const lat = Number(c[9]);
    const lng = Number(c[10]);
    if (!SUPPORTED.has(country) || !postal || !c[2] || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }
    countries.add(country);
    rows.push([
      country,
      clip(postal.replace(/\s/g, ''), 20),
      clip(c[2].trim(), 180),
      clip(c[3] && c[3].trim(), 100),
      clip(c[4] && c[4].trim(), 20),
      clip(c[5] && c[5].trim(), 100),
      lat.toFixed(6),
      lng.toFixed(6),
    ]);
  }
  if (!rows.length) {
    console.log(`${path.basename(file)}: no US/IN rows found (skipped ${skipped}).`);
    return;
  }

  await conn.beginTransaction();
  try {
    for (const country of countries) {
      await conn.query('DELETE FROM geo_postal_codes WHERE country_code = ?', [country]);
    }
    for (let i = 0; i < rows.length; i += BATCH) {
      await conn.query(
        'INSERT INTO geo_postal_codes (country_code, postal_code, place_name, admin_name1, admin_code1, admin_name2, latitude, longitude) VALUES ?',
        [rows.slice(i, i + BATCH)],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  }
  console.log(`${path.basename(file)}: imported ${rows.length} rows for ${[...countries].join(', ')} (skipped ${skipped}).`);
}

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node scripts/import-geonames-postal-codes.js <US.txt> [IN.txt …]');
    process.exit(2);
  }
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`File not found: ${f}`);
      process.exit(2);
    }
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  try {
    for (const f of files) await importFile(conn, f);
    const [summary] = await conn.query('SELECT country_code, COUNT(*) AS n FROM geo_postal_codes GROUP BY country_code');
    console.log('geo_postal_codes now:', summary.map((r) => `${r.country_code}=${r.n}`).join(', '));
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error('Import failed:', e.message);
  process.exit(1);
});
