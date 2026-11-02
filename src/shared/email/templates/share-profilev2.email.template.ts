// share-profilev2.email.template.ts
// Aurora Matrimony — Share Profile Email Template v2
//
// DESIGN: Mirrors the Aurora Matrimony profile card layout:
//   ┌──────────────────────────────────────────────────────┐
//   │  HEADER  logo area (left) + profile badge (right)   │  ← deep maroon + 4px gold strip
//   ├──────────────────────────────────────────────────────┤
//   │  Greeting + personal note from sender               │
//   ├──────────────────────────────────────────────────────┤
//   │  PROFILE HERO                                        │
//   │  [Photo portrait]  │  Name · meta strip              │
//   │                    │  ┌── Personal Details 2-col ──┐ │
//   │                    │  └────────────────────────────┘ │
//   ├─────────────────────────┬────────────────────────────┤
//   │  Career & Education     │  Horoscope  (if any)       │
//   ├──────────────────────────────────────────────────────┤
//   │  Family Background  (if any)                         │
//   ├──────────────────────────────────────────────────────┤
//   │  Partner Preferences  (if any)                       │
//   ├──────────────────────────────────────────────────────┤
//   │  4-icon feature strip                                │
//   ├──────────────────────────────────────────────────────┤
//   │  FOOTER  CTA + profile link + support               │
//   └──────────────────────────────────────────────────────┘
//
// STANDALONE FILE — contains ONLY shareProfileEmailTemplateV2
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join }        from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  Colour tokens — Aurora palette (mirrors :root CSS vars)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  roseGold:        '#b76e79',
  roseGoldLight:   '#d4a0a7',
  roseGoldLighter: '#f0d4d8',
  maroon:          '#a20000',
  maroonDark:      '#6e0000',
  maroonDeep:      '#610921',   // aurora-style deep maroon for header/footer
  ivory:           '#fffff0',
  ivoryWarm:       '#fdf8f4',
  ivoryBg:         '#FBF6EC',   // aurora card background
  gold:            '#c9a84c',
  goldLight:       '#e8d5a0',
  goldBright:      '#E8C985',   // aurora gold for header text
  goldRule:        '#D4AE68',   // aurora gold rule / border
  goldSubtle:      '#E9DCC2',   // aurora card border
  blush:           '#fde8e8',
  textPrimary:     '#3d2c2e',
  textDark:        '#2A1418',   // aurora body text
  textMuted:       '#4A2F35',   // aurora secondary text
  textLabel:       '#6E4E55',   // aurora label text
  shadow:          'rgba(183,110,121,0.15)',
  gradient:        'linear-gradient(135deg,#b76e79 0%,#a20000 100%)',
  fontname:        "'Segoe UI',Arial,sans-serif",  // --aurora-font
};

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────────────────────
function esc(raw: string | number | undefined | null): string {
  return String(raw ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

function encodeImgUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname
      .split('/')
      .map(seg => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return u.toString();
  } catch { return rawUrl; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Share icon — inline SVG Base64 data URI
// ─────────────────────────────────────────────────────────────────────────────
function getShareIconBase64(): string {
  try {
    const p = join(__dirname, '..', 'assets', 'images', 'share-profile.svg');
    return `data:image/svg+xml;base64,${readFileSync(p).toString('base64')}`;
  } catch {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Section heading row (aurora style: uppercase label + gold rule line)
// ─────────────────────────────────────────────────────────────────────────────
function sectionHeading(label: string, iconSvg = ''): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
    <tr>
      <td style="white-space:nowrap;vertical-align:middle;
                 font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;
                 letter-spacing:2.5px;text-transform:uppercase;color:${C.maroon};
                 padding-right:10px;">
        ${iconSvg ? `<span style="vertical-align:middle;margin-right:6px;">${iconSvg}</span>` : ''}
        ${label}
      </td>
      <td style="border-top:1px solid ${C.goldRule};"></td>
    </tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2-column detail grid item (aurora style: label above value)
// ─────────────────────────────────────────────────────────────────────────────
function detailCell(label: string, value: string): string {
  return `
  <td style="padding:0 20px 12px 0;vertical-align:top;">
    <span style="display:block;font-family:Arial,Helvetica,sans-serif;
                 font-size:11px;color:${C.textLabel};margin-bottom:2px;">
      ${esc(label)}
    </span>
    <span style="display:block;font-family:Arial,Helvetica,sans-serif;
                 font-size:14px;font-weight:700;color:${C.textDark};">
      ${esc(value)}
    </span>
  </td>`;
}

// Build a 2-column grid of detail cells, auto-hiding null/empty values
function detailGrid(
  items: Array<[string, string | number | null | undefined]>,
  cols = 2,
): string {
  const visible = items.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
  if (visible.length === 0) return '';

  const rows: string[] = [];
  for (let i = 0; i < visible.length; i += cols) {
    const rowItems = visible.slice(i, i + cols);
    // Pad row to full cols width
    while (rowItems.length < cols) rowItems.push(['', '']);
    rows.push(`<tr>${rowItems.map(([l, v]) => l ? detailCell(l, String(v ?? '')) : '<td></td>').join('')}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  White card wrapper (aurora-style: white bg, gold subtle border, 18px radius)
// ─────────────────────────────────────────────────────────────────────────────
function card(content: string, extraStyle = ''): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#ffffff;border:1px solid ${C.goldSubtle};
                border-radius:14px;overflow:hidden;${extraStyle}">
    <tr>
      <!-- 2px gradient top accent -->
      <td colspan="4"
          style="height:2px;background:${C.gradient};"></td>
    </tr>                
    <tr><td style="padding:20px 22px;">${content}</td></tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Feature icon pill (4-icon strip at bottom of card)
// ─────────────────────────────────────────────────────────────────────────────
function featurePill(iconPath: string, label: string): string {
  return `
  <td align="center" style="padding:0 4px;vertical-align: top;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
      <!--style="width:44px;height:44px;border-radius:50%;background:${C.maroon};-->
        <td align="center"
            style="border-radius:50%;
                   vertical-align:middle;">
          <img src="${iconPath}" width="60" height="56"
               style="display:block;margin:1px auto;border:0;" />
        </td>
      </tr>
      <tr>
        <td align="center"
            style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
                   font-weight:600;color:${C.textMuted};padding-top:6px;
                   line-height:1.4;max-width:80px;">
          ${label}
        </td>
      </tr>
    </table>
  </td>`;
}

// Tiny inline SVG as data URI for feature icons
function svgDataUri(svgBody: string): string {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${C.goldBright}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svgBody}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(full).toString('base64')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Security — escapeHtml()
//  Every user-supplied value MUST pass through this before insertion.
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(raw: string | number | undefined | null): string {
  return String(raw ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Profile interface
// ─────────────────────────────────────────────────────────────────────────────
export interface ShareProfileV2Params {
  // ── Sender / recipient ───────────────────────────────────────────────────
  senderName:    string;
  receiverName:  string;
  profileUrl:    string;
  subject:       string;
  body?:         string;   // personal message from sender
  domain:        string;

  // ── Logo ─────────────────────────────────────────────────────────────────
  logoUrl?:      string;   // Aurora logo image URL (optional; text fallback used)

  // ── Profile ───────────────────────────────────────────────────────────────
  profile: {
    photoUrl?:            string;
    name:                 string;
    profileId?:           string;   // e.g. "SUH10234"
    gender?:              'Bride' | 'Groom' | string;
    dateOfBirth?:         string;
    age?:                 number;
    height?:              string;
    religion?:            string;
    caste?:               string;
    motherTongue?:        string;
    city?:                string;
    country?:             string;
    willingToRelocate?:   'Yes' | 'No' | string;
    about?:               string;   // italic quote under name

    // ── Career & Education ───────────────────────────────────────────────
    education?:           string;
    occupation?:          string;
    employer?:            string;
    annualIncome?:        string;

    // ── Horoscope ────────────────────────────────────────────────────────
    rasi?:                string;
    nakshatra?:           string;
    lagna?:               string;
    manglik?:             string;
    tossing?:             string;

    // ── Family ───────────────────────────────────────────────────────────
    fatherOccupation?:    string;
    motherOccupation?:    string;
    siblings?:            string;
    familyType?:          string;
    familyNote?:          string;

    // ── Partner preferences ───────────────────────────────────────────────
    preferenceAge?:       string;   // e.g. "25 – 35 years"
    preferenceReligion?:  string;
    preferenceEducation?: string;
    preferenceNote?:      string;
    preferenceFamilyType?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  shareProfileEmailTemplateV2
// ─────────────────────────────────────────────────────────────────────────────
export const shareProfileEmailTemplateV2 = (params: ShareProfileV2Params): string => {

  const { senderName, receiverName, profileUrl, domain } = params;
  const p          = params.profile;
  const year       = new Date().getFullYear();
  const shareIcon  = getShareIconBase64();
  const safeUrl    = encodeImgUrl(profileUrl);
  const safePhoto  = p.photoUrl ? encodeImgUrl(p.photoUrl) : null;
  const initial    = p.name.trim().charAt(0).toUpperCase() || '?';
  const sInitial   = senderName.trim().charAt(0).toUpperCase() || 'S';
  const genderBadge = p.gender ?? 'Profile';
  const note = (params.body ?? '').trim() ||
    `I came across this profile on Aurora Matrimony and felt it could be a wonderful match. Please take a look!`;
  //const logoUrl = params.logoUrl || 'https://storage.googleapis.com/inv-images/matrimony/home/circle-crop-trns.png';
  const logoUrl = params.logoUrl || 'https://storage.googleapis.com/inv-images/matrimony/home/firefly.png';
  
  // ── Logo block ────────────────────────────────────────────────────────────
  // If a logoUrl is provided, show it as an image; otherwise pure text brand name.
  // Logo container is 180×72 so the image always fits without overflow.
  const logoBlock = logoUrl
    ? `<img src="${encodeImgUrl(logoUrl)}" alt="Aurora Matrimony"
            height="48" style="display:block;height:48px;max-width:180px;
                               object-fit:contain;border:0;" />`
    : `<span style="font-family:${C.fontname};
                    font-size:26px;font-weight:700;
                    color:${C.goldBright};letter-spacing:0.5px;
                    line-height:1;">Aurora Matrimony</span>`;
  const headerBlock = `<span style="font-family:${C.fontname};
                  font-size:28px;font-weight:700;
                  color:${C.goldBright};letter-spacing:0.5px;
                  line-height:1;">Aurora Matrimony</span>`;

  // ── Photo or initials portrait ────────────────────────────────────────────
  const photoBlock = safePhoto
    ? `<img src="${safePhoto}" alt="${esc(p.name)}"
            width="160" height="200"
            style="display:block;width:160px;height:200px;
                   border-radius:80px 80px 12px 12px;
                   object-fit:cover;border:0;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" width="160" height="200">
         <tr>
           <td align="center" valign="middle"
               style="width:160px;height:200px;
                      border-radius:80px 80px 12px 12px;
                      background:${C.roseGoldLighter};
                      font-family:${C.fontname};
                      font-size:56px;font-weight:700;color:${C.maroon};">
             ${initial}
           </td>
         </tr>
       </table>`;

  // ── Feature icon data URIs ────────────────────────────────────────────────
  const iconCommunity1 = svgDataUri(`<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.7 5 5.8"/>`);
  const iconHoroscope1 = svgDataUri(`<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3z"/>`);
  const iconPrivacy1   = svgDataUri(`<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`);
  const iconHeart1     = svgDataUri(`<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>`);

  const iconCommunity = 'https://storage.googleapis.com/inv-images/matrimony/icon/tsgroup.png';
  const iconHoroscope = 'https://storage.googleapis.com/inv-images/matrimony/icon/tsstar.png';
  const iconPrivacy   = 'https://storage.googleapis.com/inv-images/matrimony/icon/tsprivacy.png';
  const iconHeart     = 'https://storage.googleapis.com/inv-images/matrimony/icon/tshearty.png';

  // ── Section: horoscope (shown only if at least one field has a value) ─────
  const hasHoroscope = [p.rasi, p.nakshatra, p.lagna, p.manglik].some(v => v);
  const horoscopeSection = hasHoroscope
    ? card(`
        ${sectionHeading('Horoscope')}
        ${detailGrid([
          ['Rasi (Moon sign)', p.rasi],
          ['Nakshatra',        p.nakshatra],
          ['Lagna',            p.lagna],
          ['Manglik',          p.manglik],
        ])}`)
    : '';

  // ── Section: family ───────────────────────────────────────────────────────
  const hasFamily = [p.fatherOccupation, p.motherOccupation, p.siblings, p.familyType, p.familyNote].some(v => v);
  const familySection = hasFamily
    ? card(`
        ${sectionHeading('Family Background')}
        ${detailGrid([
          ["Father's Occupation", p.fatherOccupation],
          ["Mother's Occupation", p.motherOccupation],
          ['Siblings',            p.siblings],
          ['Family Type',         p.familyType],
        ])}
        ${p.familyNote ? `
        <p style="margin:8px 0 0;font-family:${C.fontname};
                  font-size:13px;color:${C.textMuted};
                  font-style:italic;line-height:1.6;">
          &ldquo;${esc(p.familyNote)}&rdquo;
        </p>` : ''}`)
    : '';

  // ── Section: partner preferences ─────────────────────────────────────────
  const hasPrefs = [p.preferenceAge, p.preferenceReligion, p.preferenceEducation, p.preferenceNote].some(v => v);
  const prefsSection = hasPrefs
    ? card(`
        ${sectionHeading('Partner Preferences')}
        ${detailGrid([
          ['Age range',  p.preferenceAge],
          ['Religion',   p.preferenceReligion],
          ['Education',  p.preferenceEducation],
        ], 3)}
        ${p.preferenceNote ? `
        <p style="margin:10px 0 0;font-family:${C.fontname};
                  font-size:13px;color:${C.textMuted};line-height:1.6;">
          ${esc(p.preferenceNote)}
        </p>` : ''}`)
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${esc(senderName)} shared a profile with you – Aurora Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};
             font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${C.blush};padding:32px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:620px;background:${C.ivoryBg};border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

          <!-- ══════════════════════════════════════════════════
               HEADER  — deep maroon + 4px gold bottom border
               Left: logo + brand name + tagline
               Right: gender badge + profile ID + domain
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="background:${C.maroonDeep};padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- 4px gold rule -->
                <tr>
                  <td colspan="3"
                      style="height:4px;background:linear-gradient(90deg,
                             ${C.goldRule} 0%,${C.goldBright} 50%,${C.goldRule} 100%);">
                  </td>
                </tr>

                <tr>
                  <!-- Logo + brand name -->
                  <td style="padding:28px 16px 24px 16px;vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <!-- Logo image container: fixed 180×72, object-fit:contain -->
                        <td style="vertical-align:middle;padding-right:16px;">
                          <table cellpadding="0" cellspacing="0" border="0"
                                 style="height:72px;overflow:hidden;">
                            <tr>
                              <td align="center" valign="middle"
                                  style="height:72px;">
                                ${logoBlock}
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Brand text column — only shown when no logoUrl -->
                        ${logoUrl ? `
                        <td style="vertical-align:middle;
                                   border-left:0px solid rgba(212,174,104,0.4);
                                   padding-left:1px;">
                                   ${headerBlock}
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                                    font-size:10px;font-weight:700;
                                    text-transform:uppercase;letter-spacing:2px;
                                    color:${C.goldRule};">
                            ━&nbsp; Where Forever Begins &nbsp;━
                          </p>
                        </td>` : ''}
                      </tr>
                    </table>
                  </td>

                  <!-- Profile badge + ID + domain (right-aligned) -->
                  <td style="padding:28px 24px 24px 0;vertical-align:middle;
                             text-align:right;white-space:nowrap;">
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="margin-left:auto;">
                      <tr>
                        <td align="right">
                          <!-- Gender badge pill -->
                          <div style="display:inline-block;background:${C.goldBright};
                                      color:${C.maroonDeep};font-family:Arial,Helvetica,sans-serif;
                                      font-size:11px;font-weight:700;letter-spacing:2.5px;
                                      padding:6px 16px;border-radius:999px;
                                      text-transform:uppercase;margin-bottom:8px;">
                            ${esc(genderBadge)} Profile
                          </div>
                        </td>
                      </tr>
                      ${p.profileId ? `
                      <tr>
                        <td align="right" style="font-family:Arial,Helvetica,sans-serif;
                                                  font-size:12px;color:rgba(243,227,191,0.9);
                                                  letter-spacing:0.5px;padding-bottom:4px;">
                          Profile ID &middot;
                          <strong style="color:#ffffff;">${esc(p.profileId)}</strong>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td align="right" style="font-family:Arial,Helvetica,sans-serif;
                                                  font-size:11px;color:rgba(243,227,191,0.7);">
                          ${domain}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tagline separator (shown only when logo is present) -->
                ${params.logoUrl ? `
                <tr>
                  <td colspan="2"
                      style="padding:0 32px 20px;font-family:${C.fontname};
                             font-style:italic;font-size:13px;
                             color:rgba(243,227,191,0.75);
                             text-align:center;letter-spacing:1px;">
                    <span style="display:inline-block;
                                 border-top:1px solid rgba(212,174,104,0.35);
                                 padding-top:10px;width:100%;">
                      ━&ensp; Where Forever Begins &ensp;━
                    </span>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════════════════════
               GREETING + PERSONAL NOTE
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0 0 6px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Dear <strong>${esc(receiverName)}</strong>,
              </p>
              <!--<div style="width:36px;height:3px;background:${C.gradient};
                          border-radius:2px;margin:0 0 14px;"></div>
              <p style="margin:0 0 18px;font-size:14px;color:${C.textMuted};line-height:1.8;">
                <strong style="color:${C.maroon};">${esc(senderName)}</strong>
                came across a profile on <strong>Aurora Matrimony</strong> and
                wanted to share it with you — they think it could be a wonderful match!
              </p>-->

              <!-- Sender note — left maroon bar quote -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:24px;">
                <tr>
                  <td width="4"
                      style="background:${C.maroon};border-radius:2px;"></td>
                  <td style="padding:12px 16px;background:${C.ivoryWarm};
                             border-radius:0 10px 10px 0;
                             border:1px solid ${C.roseGoldLighter};border-left:none;">
                    <p style="margin:0;font-family:${C.fontname};
                              font-size:13px;color:${C.textPrimary};
                              font-style:italic;line-height:1.75;">
                      &ldquo;${esc(note)}&rdquo;
                    </p>
                    <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;
                              font-size:11px;color:${C.roseGold};">
                      — ${esc(senderName)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════════════════════
               PROFILE HERO
               Left: portrait photo (gold-bordered)
               Right: name + meta + personal details grid
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:0 32px 20px;">

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr valign="top">

                  <!-- Photo portrait -->
                  <td style="width:180px;padding-right:24px;padding-top:4px;">
                    <!-- Gold border frame: 8px padding + 2px gold border -->
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="border:2px solid ${C.goldRule};
                                  border-radius:86px 86px 18px 18px;
                                  background:#ffffff;padding:8px;
                                  display:inline-block;">
                      <tr>
                        <td align="center">
                          ${photoBlock}
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Name + details -->
                  <td style="vertical-align:top;">

                    <!-- Name -->
                    <h2 style="margin:0 0 4px;font-family:${C.fontname};
                               font-size:26px;font-weight:700;color:${C.maroon};
                               line-height:1.1;letter-spacing:-0.3px;">
                      ${esc(p.name)}
                    </h2>

                    <!-- Quick meta strip -->
                    <p style="margin:0 0 4px;font-size:13px;color:${C.textMuted};
                              font-weight:500;">
                      ${[
                        p.age       ? `${p.age} yrs`   : null,
                        p.height    ? p.height          : null,
                        p.city      ? p.city            : null,
                      ].filter(Boolean).map(esc).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;')}
                    </p>

                    <!-- About italic quote -->
                    ${p.about ? `
                    <p style="margin:4px 0 12px;font-family:${C.fontname};
                              font-style:italic;font-size:13px;
                              color:${C.textMuted};line-height:1.45;">
                      &ldquo;${esc(p.about)}&rdquo;
                    </p>` : `<div style="height:10px;"></div>`}

                    <!-- Personal details 2-col grid inside white card -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                           style="background:#ffffff;border:1px solid ${C.goldSubtle};
                                  border-radius:12px;overflow:hidden;">
                      <tr>
                        <!-- 2px gradient top accent -->
                        <td colspan="4"
                            style="height:2px;background:${C.gradient};"></td>
                      </tr>
                      <tr>
                        <td colspan="4" style="padding:14px 16px 4px;">
                          ${sectionHeading('Personal Details')}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="4" style="padding:0 16px 12px;">
                          ${detailGrid([
                            ['Date of Birth', p.dateOfBirth],
                            ['Religion',      p.religion],
                            ['Caste',         p.caste],
                            ['Mother Tongue', p.motherTongue],
                            ['Country',       p.country],
                            ['Relocate',      p.willingToRelocate],
                          ])}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════════════════════
               CAREER & EDUCATION  |  HOROSCOPE
               Side-by-side (or full-width if no horoscope)
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:0 32px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr valign="top">

                  <!-- Career card -->
                  <td style="${hasHoroscope ? 'width:48%;padding-right:8px;' : ''}">
                    ${card(`
                      ${sectionHeading('Career & Education')}
                      ${detailGrid([
                        ['Education',  p.education],
                        ['Occupation', p.occupation],
                        ['Employer',   p.employer],
                        ['Income',     p.annualIncome],
                      ], 1)}
                    `)}
                  </td>

                  <!-- Horoscope card (hidden if no data) -->
                  ${hasHoroscope ? `
                  <td style="width:48%;padding-left:8px;">
                    ${card(`
                      ${sectionHeading('Horoscope')}
                      ${detailGrid([
                        ['Rasi',      p.rasi],
                        ['Nakshatra', p.nakshatra],
                        ['Lagna',     p.lagna],
                        ['Manglik',   p.manglik],
                      ], 1)}
                    `)}
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Family & Preferences (full-width, auto-hidden if empty) ── -->
          ${hasFamily || hasPrefs ? `
          <tr>
            <td style="padding:0 32px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr valign="top">
                  ${hasFamily ? `<td style="${hasPrefs ? 'width:48%;padding-right:8px;' : ''}">${familySection}</td>` : ''}
                  ${hasPrefs  ? `<td style="${hasFamily ? 'width:48%;padding-left:8px;'  : ''}">${prefsSection}</td>`  : ''}
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- ══════════════════════════════════════════════════
               4-ICON FEATURE STRIP
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:8px 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${featurePill(iconCommunity, 'All communities welcome')}
                  ${featurePill(iconHoroscope, 'Horoscope matching')}
                  ${featurePill(iconPrivacy,   'Privacy-protected profiles')}
                  ${featurePill(iconHeart,     'Personal matchmaking support')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════════════════════
               CTA BUTTON + PROFILE LINK
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}"
                       style="display:inline-block;
                              background:${C.maroonDeep};
                              color:#ffffff;text-decoration:none;
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:14px;font-weight:700;
                              padding:14px 40px;border-radius:50px;
                              box-shadow:0 6px 20px rgba(97,9,33,0.35);
                              letter-spacing:0.3px;">
                      &#128100;&nbsp; View Full Profile
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Profile link box -->
              <div style="background:${C.roseGoldLighter};border-radius:10px;
                          border:1px solid ${C.roseGoldLight};
                          padding:14px 16px;">
                <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;
                          font-size:10px;font-weight:700;text-transform:uppercase;
                          letter-spacing:1.4px;color:${C.roseGold};">
                  Shared Profile Link
                </p>
                <a href="${safeUrl}"
                   style="font-family:'Courier New',Courier,monospace;
                          font-size:11px;color:${C.maroon};
                          word-break:break-all;text-decoration:none;">
                  ${safeUrl}
                </a>
              </div>
            </td>
          </tr>

          <!-- Privacy note -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:12px 16px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:12px;color:${C.maroonDark};line-height:1.6;">
                      <strong>&#128274;&nbsp; Your privacy is always protected.</strong>
                      <span style="color:${C.textMuted};">
                        Contact details remain hidden until both members choose to connect.
                      </span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════════════════════
               FOOTER  — deep maroon, aurora-style
               Left: phone/CTA   Right: sender sign-off
               ══════════════════════════════════════════════════ -->
          <tr>
            <td style="background:${C.maroonDeep};
                       border-top:4px solid ${C.goldRule};
                       padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr valign="middle">

                  <!-- Left: CTA text -->
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 4px;font-family:${C.fontname};
                              font-size:16px;font-weight:700;color:#ffffff;line-height:1.2;">
                      Register today &amp; meet your perfect match
                    </p>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:12px;color:rgba(243,227,191,0.8);">
                      Your forever begins here &middot; ${domain}
                    </p>
                  </td>

                  <!-- Right: sender sign-off initial -->
                  <td style="vertical-align:middle;text-align:right;
                             padding-left:24px;white-space:nowrap;">
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="margin-left:auto;">
                      <tr>
                        <td align="right" style="padding-bottom:6px;">
                          <!-- Sender initial circle -->
                          <table cellpadding="0" cellspacing="0" border="0"
                                 style="display:inline-table;">
                            <tr>
                              <td align="center" valign="middle"
                                  style="width:40px;height:40px;border-radius:50%;
                                         background:${C.gradient};
                                         border:2px solid ${C.goldBright};
                                         font-family:${C.fontname};
                                         font-size:18px;font-weight:700;
                                         color:#ffffff;">
                                ${sInitial}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="right"
                            style="font-family:${C.fontname};
                                   font-size:13px;font-weight:700;
                                   color:${C.goldBright};">
                          ${esc(senderName)}
                        </td>
                      </tr>
                      <tr>
                        <td align="right"
                            style="font-family:Arial,Helvetica,sans-serif;
                                   font-size:10px;
                                   color:rgba(243,227,191,0.7);">
                          via Aurora Matrimony
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Copyright strip -->
                <tr>
                  <td colspan="2"
                      style="padding-top:16px;border-top:1px solid rgba(212,174,104,0.3);
                             font-family:Arial,Helvetica,sans-serif;font-size:11px;
                             color:rgba(243,227,191,0.5);text-align:center;">
                    © ${year} Aurora Matrimony. All rights reserved.
                    &nbsp;&middot;&nbsp;
                    <a href="mailto:support@${domain}"
                       style="color:${C.goldBright};text-decoration:none;">
                      support@${domain}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`.trim();
};


/* ─────────────────────────────────────────────────────────────────────────────
   USAGE EXAMPLE
   ─────────────────────────────────────────────────────────────────────────────

import { shareProfileEmailTemplateV2 } from './share-profilev2.email.template';

const html = shareProfileEmailTemplateV2({
  senderName:   'Arjun Sharma',
  receiverName: 'Ravi Kumar',
  profileUrl:   'https://www.aurorammatrimony.com/profile/ishwarya-reddy',
  domain:       'aurorammatrimony.com',
  logoUrl:      'https://storage.googleapis.com/.../aurora-logo.png',   // optional
  body:         'I think she is a perfect match for you. Take a look!',

  profile: {
    photoUrl:            'https://storage.googleapis.com/.../ishwarya.jpg',
    name:                'Ishwarya Reddy',
    profileId:           'SUH10234',
    gender:              'Bride',
    dateOfBirth:         '21 Sep 1993',
    age:                 32,
    height:              "5'9\"",
    religion:            'Hindu',
    caste:               'Nair',
    motherTongue:        'Malayalam',
    city:                'Orlando, Florida',
    country:             'USA',
    willingToRelocate:   'No',
    about:               'A data scientist who loves exploring new cultures and brings warmth wherever she goes.',

    education:           "Master's Degree",
    occupation:          'Data Scientist',
    employer:            'Microsoft',
    annualIncome:        '$140,000',

    rasi:                'Mesha',
    nakshatra:           'Ashwini',
    lagna:               'Vrishabha',
    manglik:             'No',

    fatherOccupation:    'Retired Government Officer',
    motherOccupation:    'Homemaker',
    siblings:            '1 brother',
    familyType:          'Nuclear family',
    familyNote:          'Looking for a well-educated, family-oriented partner.',

    preferenceAge:       '28 – 36 years',
    preferenceReligion:  'Hindu',
    preferenceEducation: "Bachelor's / Master's",
    preferenceNote:      'Looking for someone who is supportive of her career and shares her love for travel.',
  },
});
*/
