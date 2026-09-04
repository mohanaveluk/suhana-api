// share-profile.email.template.ts
// Aurora Matrimony — Share Profile Email Template
// STANDALONE FILE — contains ONLY shareProfileEmailTemplate
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { join }        from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  Colour tokens — mirrors :root CSS vars in styles.scss exactly
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  roseGold:        '#b76e79',   // --suhana-rose-gold
  roseGoldLight:   '#d4a0a7',   // --suhana-rose-gold-light
  roseGoldLighter: '#f0d4d8',   // --suhana-rose-gold-lighter
  maroon:          '#a20000',   // --suhana-maroon
  maroonDark:      '#6e0000',   // --suhana-maroon-dark
  ivory:           '#fffff0',   // --suhana-ivory
  ivoryWarm:       '#fdf8f4',   // --suhana-ivory-warm
  gold:            '#c9a84c',   // --suhana-gold
  goldLight:       '#e8d5a0',   // --suhana-gold-light
  blush:           '#fde8e8',   // --suhana-blush
  textPrimary:     '#3d2c2e',   // --suhana-text-primary
  textSecondary:   '#6b5557',   // --suhana-text-secondary
  shadow:          'rgba(183,110,121,0.15)',
  gradient:        'linear-gradient(135deg,#b76e79 0%,#a20000 100%)',
  gradientLight:   'linear-gradient(135deg,#fff0f2 0%,#f2e5e5 100%)',
  gradientdark:    'linear-gradient(359deg,#790b1c 0%,#a20000 100%);',

  fontname:        "'Segoe UI',Arial,sans-serif",  // --suhana-font
};

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
//  Defensive URL encoder — handles GCS paths with spaces / parentheses
// ─────────────────────────────────────────────────────────────────────────────
function encodeImageUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname
      .split('/')
      .map(seg => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Share icon — inline SVG as Base64 data URI (no external request)
// ─────────────────────────────────────────────────────────────────────────────
function getShareIconBase64(): string {
  try {
    const svgPath = join(__dirname, '..', 'assets', 'images', 'share-profile.svg');
    return `data:image/svg+xml;base64,${readFileSync(svgPath).toString('base64')}`;
  } catch {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      width="40" height="40" fill="white">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49"
            stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"
            stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(fallback).toString('base64')}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Section heading pill — sits above each profile card section */
function sectionHead(label: string): string {
  return `
  <tr>
    <td colspan="2"
        style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;
               font-size:10px;font-weight:700;text-transform:uppercase;
               letter-spacing:1.6px;color:${C.roseGold};">
      ${label}
    </td>
  </tr>`;
}

/** Single label | value row inside a profile section table */
function profileRow(label: string, value: string, isLast = false): string {
  const border = isLast ? '' : `border-bottom:1px solid ${C.roseGoldLighter};`;
  return `
  <tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
               font-weight:700;color:${C.textSecondary};
               padding:9px 0;vertical-align:top;white-space:nowrap;
               width:148px;${border}">
      ${label}
    </td>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
               color:${C.textPrimary};padding:9px 0 9px 14px;
               vertical-align:top;line-height:1.5;${border}">
      ${value}
    </td>
  </tr>`;
}

/** Render a section block: heading + rows, wrapped in the ivory card shell.
    Rows whose value is null/undefined/"" are automatically hidden. */
function profileSection(
  heading: string,
  rows: Array<[string, string | number | null | undefined, boolean?]>,
): string {
  const visibleRows = rows.filter(([, val]) => val !== null && val !== undefined && String(val).trim() !== '');
  if (visibleRows.length === 0) return '';   // hide entire section if nothing to show

  const rowHtml = visibleRows
    .map(([label, val, isLast], idx) =>
      profileRow(escapeHtml(label), escapeHtml(val), isLast ?? idx === visibleRows.length - 1))
    .join('');

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#ffffff;border-radius:12px;overflow:hidden;
                border:1px solid ${C.roseGoldLighter};margin-bottom:16px;">
    <!-- Section colour bar -->
    <tr>
      <td style="height:3px;background:${C.gradient};border-radius:12px 12px 0 0;"
          colspan="2"></td>
    </tr>
    <tr>
      <td colspan="2" style="padding:16px 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${sectionHead(heading)}
        </table>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 20px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rowHtml}
        </table>
      </td>
    </tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Profile interface
// ─────────────────────────────────────────────────────────────────────────────
export interface ShareProfileParams {

  // ── Sender / recipient ─────────────────────────────────────────────────────
  senderName:    string;
  receiverName:  string;
  profileUrl:    string;   // full URL to the profile page
  subject?:      string;   // optional email <title>
  body?:         string;   // optional personal message from sender
  domain:        string;   // for footer support link

  // ── Personal details ──────────────────────────────────────────────────────
  profile: {
    photoUrl?:            string;
    name:                 string;
    dateOfBirth?:         string;   // e.g. "21 Sep 1993"
    age?:                 number;   // e.g. 32
    height?:              string;   // e.g. "5'9\""
    religion?:            string;
    caste?:               string;
    occupation?:          string;
    annualIncome?:        string;   // e.g. "$140,000"
    education?:           string;
    motherTongue?:        string;
    city?:                string;
    country?:             string;
    willingToRelocate?:   'Yes' | 'No' | string;

    // ── Horoscope (hidden if all null) ────────────────────────────────────
    rasi?:                string;
    nakshatra?:           string;
    manglik?:             string;   // "Yes" | "No"

    // ── Family (hidden if all null) ───────────────────────────────────────
    fatherOccupation?:    string;
    motherOccupation?:    string;
    siblings?:            string;   // e.g. "1 brother, 1 sister"
    familyNote?:          string;   // free-text family preference note
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  shareProfileEmailTemplate
// ─────────────────────────────────────────────────────────────────────────────
export const shareProfileEmailTemplate = (params: ShareProfileParams): string => {

  const { senderName, receiverName, profileUrl, domain } = params;
  const p          = params.profile;
  const year       = new Date().getFullYear();
  const shareIcon  = "https://storage.googleapis.com/inv-images/home/fav-flrnd.png";
  const initial    = senderName.trim().charAt(0).toUpperCase() || 'S';

  // Safe URL for profile page link
  const safeProfileUrl = encodeImageUrl(profileUrl);

  // Safe photo URL (or null → use initials avatar)
  const safePhotoUrl = p.photoUrl ? encodeImageUrl(p.photoUrl) : null;
  const profileInitial = p.name.trim().charAt(0).toUpperCase() || '?';

  // Personal message
  const personalNote = (params.body ?? '').trim()
    || `I came across this profile on Aurora Matrimony and felt it might be a wonderful match. Please take a look and let me know what you think!`;

  const emailSubject = (params.subject ?? '').trim()
    || `${senderName} shared a profile with you on Aurora Matrimony`;

  // ── Photo or initials avatar ─────────────────────────────────────────────
  const photoBlock = safePhotoUrl
    ? `<img src="${safePhotoUrl}" alt="${escapeHtml(p.name)}"
            width="110" height="110"
            style="display:block;width:110px;height:110px;border-radius:50%;
                   object-fit:cover;
                   border:4px solid ${C.goldLight};
                   box-shadow:0 6px 20px rgba(162,0,0,0.2);
                   margin:0 auto;" />`
    : `<table cellpadding="0" cellspacing="0" border="0"
              style="margin:0 auto;">
         <tr>
           <td align="center" valign="middle"
               style="width:110px;height:110px;border-radius:50%;
                      background:${C.gradient};
                      border:4px solid ${C.goldLight};
                      box-shadow:0 6px 20px rgba(162,0,0,0.2);
                      font-family:${C.fontname};
                      font-size:44px;font-weight:700;color:#ffffff;">
             ${profileInitial}
           </td>
         </tr>
       </table>`;

  // ── Build profile sections ───────────────────────────────────────────────
  const personalSection = profileSection('Personal Details', [
    ['Date of Birth',        p.dateOfBirth],
    ['Age',                  p.age ? `${p.age} Years` : null],
    ['Height',               p.height],
    ['Religion',             p.religion],
    ['Caste',                p.caste],
    ['Mother Tongue',        p.motherTongue],
    ['City',                 p.city],
    ['Country',              p.country],
    ['Willing to Relocate',  p.willingToRelocate],
  ]);

  const careerSection = profileSection('Career & Education', [
    ['Occupation',    p.occupation],
    ['Annual Income', p.annualIncome],
    ['Education',     p.education],
  ]);

  const horoscopeSection = profileSection('Horoscope Details', [
    ['Rasi',      p.rasi],
    ['Nakshatra', p.nakshatra],
    ['Manglik',   p.manglik],
  ]);

  const familySection = profileSection('Family Background', [
    ['Father\'s Occupation', p.fatherOccupation],
    ['Mother\'s Occupation', p.motherOccupation],
    ['Siblings',             p.siblings],
    ['Family Note',          p.familyNote],
  ]);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};
             font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

          <!-- ══════════════════════════════════
               HEADER
               ══════════════════════════════════ -->
          <tr>
            <td style="background:${C.gradient};padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- 4px gold top strip -->
                <tr>
                  <td style="height:4px;
                             background:linear-gradient(90deg,
                               ${C.gold} 0%,${C.goldLight} 50%,${C.gold} 100%);">
                  </td>
                </tr>

                <tr>
                  <td style="padding:36px 40px 28px;text-align:center;">

                    <!-- Share icon in frosted box -->
                    <div style="display:inline-block;background:rgba(255,255,255,0.78);
                                border-radius:50px;padding:3px;margin-bottom:18px;">
                      <img src="${shareIcon}" alt="Share profile"
                           width="40" height="40" style="display:block;border:0;" />
                    </div>

                    <h1 style="margin:0 0 8px;font-family:${C.fontname};
                               font-size:24px;font-weight:700;color:#ffffff;
                               letter-spacing:-0.3px;">
                      Someone Shared a Profile With You!
                    </h1>
                    <p style="margin:0;font-size:14px;
                              color:rgba(255,255,255,0.82);line-height:1.5;">
                      A Aurora Matrimony member thinks this could be your perfect match
                    </p>

                    <!-- Gold badge -->
                    <div style="display:inline-block;background:rgba(201,168,76,0.22);
                                border:1px solid rgba(201,168,76,0.45);
                                border-radius:50px;padding:6px 18px;margin-top:16px;">
                      <span style="font-size:13px;font-weight:600;
                                   color:${C.goldLight};letter-spacing:0.3px;
                                   font-family:${C.fontname}">
                        &#10024;&nbsp; Shared by ${escapeHtml(senderName)}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════
               BODY
               ══════════════════════════════════ -->
          <tr>
            <td style="padding:40px 40px 8px;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:15px;color:${C.textPrimary};
                        line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                Dear <strong>${escapeHtml(receiverName)}</strong>,
              </p>
              <div style="width:40px;height:3px;background:${C.gradient};
                          border-radius:2px;margin:0 0 18px;"></div>

              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;
                        font-size:15px;color:${C.textPrimary};line-height:1.8;">
                <strong style="color:${C.maroon};">${escapeHtml(senderName)}</strong>
                came across a profile on <strong>Aurora Matrimony</strong> and wanted
                to share it with you — they think it could be a wonderful match!
              </p>

              <!-- ── Personal note from sender ──────────────────────────── -->
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;font-weight:700;text-transform:uppercase;
                        letter-spacing:1.4px;color:${C.roseGold};">
                Message from ${escapeHtml(senderName)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:32px;">
                <tr>
                  <td width="4"
                      style="background:${C.maroon};border-radius:2px;"></td>
                  <td style="padding:14px 18px;background:${C.ivoryWarm};
                             border-radius:0 10px 10px 0;
                             border:1px solid ${C.roseGoldLighter};
                             border-left:none;">
                    <p style="margin:0;font-family:${C.fontname};
                              font-size:14px;color:${C.textPrimary};
                              font-style:italic;line-height:1.75;">
                      &ldquo;${escapeHtml(personalNote)}&rdquo;
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ═══════════════════════════════════════════
                   PROFILE CARD
                   Full-width rich card: photo hero + 4 sections
                   ═══════════════════════════════════════════ -->

              <!-- Section divider label -->
              <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;font-weight:700;text-transform:uppercase;
                        letter-spacing:1.6px;color:${C.roseGold};">
                Profile Details
              </p>

              <!-- ── Photo hero banner ──────────────────────────────────── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:${C.gradientdark};border-radius:16px 16px 0 0;
                            overflow:hidden;margin-bottom:0;">
                <tr>
                  <td style="padding:28px 24px 20px;text-align:center;">

                    <!-- Rounded photo / initials -->
                    ${photoBlock}

                    <!-- Name -->
                    <p style="margin:14px 0 4px;font-family:${C.fontname};
                              font-size:20px;font-weight:700;color:#ffffff;
                              letter-spacing:-0.2px;">
                      ${escapeHtml(p.name)}
                    </p>

                    <!-- Quick meta strip: age · city · occupation -->
                    <p style="margin:0;font-family:${C.fontname};
                              font-size:13px;color:rgba(255,255,255,0.82);">
                      ${[
                        p.age        ? `${p.age} yrs`    : null,
                        p.city       ? p.city             : null,
                        p.occupation ? p.occupation        : null,
                      ].filter(Boolean).map(escapeHtml).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}
                    </p>

                    <!-- View Profile CTA inside the hero -->
                    <a href="${safeProfileUrl}"
                       style="display:inline-block;margin-top:16px;
                              background:rgba(255,255,255,0.18);
                              color:#ffffff;text-decoration:none;
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:13px;font-weight:700;
                              padding:9px 24px;border-radius:50px;
                              border:1.5px solid rgba(255,255,255,0.45);
                              letter-spacing:0.3px;">
                      View Full Profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ── Profile sections wrapper ──────────────────────────── -->
              <div style="border:1px solid ${C.roseGoldLighter};
                          border-top:none;border-radius:0 0 16px 16px;
                          overflow:hidden;margin-bottom:28px;padding:20px 20px 4px;">

                ${personalSection}
                ${careerSection}
                ${horoscopeSection}
                ${familySection}

              </div>
              <!-- /profile card -->

              <!-- ── Profile link display box ──────────────────────────── -->
              <div style="background:${C.roseGoldLighter};border-radius:12px;
                          border:1px solid ${C.roseGoldLight};
                          padding:18px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;
                          font-size:10px;font-weight:700;text-transform:uppercase;
                          letter-spacing:1.4px;color:${C.roseGold};">
                  Shared Profile Link
                </p>
                <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;
                          font-size:12px;word-break:break-all;">
                  <a href="${safeProfileUrl}"
                     style="color:${C.maroon};text-decoration:none;font-weight:600;
                            font-family:'Courier New',Courier,monospace;">
                    ${safeProfileUrl}
                  </a>
                </p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                          font-size:11px;color:${C.textSecondary};">
                  Copy this link and paste into your browser if the button above does not work.
                </p>
              </div>

              <!-- ── Primary CTA ──────────────────────────────────────── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${safeProfileUrl}"
                       style="display:inline-block;
                              background:${C.gradient};
                              color:#ffffff;text-decoration:none;
                              font-family:Arial,Helvetica,sans-serif;
                              font-size:15px;font-weight:700;
                              padding:15px 40px;border-radius:50px;
                              box-shadow:0 6px 20px rgba(162,0,0,0.32);
                              letter-spacing:0.3px;">
                      &#128100;&nbsp; View Full Profile
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ── Privacy note ─────────────────────────────────────── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:8px;">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:13px 18px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:13px;color:${C.maroonDark};line-height:1.65;">
                      <strong>&#128274;&nbsp; Your privacy is always protected.</strong>
                      <span style="color:${C.textSecondary};">
                        Contact details remain hidden until both members choose
                        to connect on Aurora Matrimony.
                      </span>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ══════════════════════════════════
               SIGN-OFF — sender initial + name
               ══════════════════════════════════ -->
          <tr>
            <td style="background:${C.ivoryWarm};
                       border-top:1px solid ${C.roseGoldLighter};padding:24px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Sender initial circle -->
                  <td width="48" valign="middle" style="padding-right:14px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" valign="middle"
                            style="width:42px;height:42px;border-radius:50%;
                                   background:${C.gradient};
                                   border:2px solid ${C.goldLight};
                                   font-family:${C.fontname};
                                   font-size:19px;font-weight:700;
                                   color:#ffffff;">
                          ${initial}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Text -->
                  <td valign="middle">
                    <p style="margin:0 0 1px;font-family:${C.fontname};
                              font-size:13px;color:${C.textSecondary};">
                      Shared with warm wishes by
                    </p>
                    <p style="margin:0 0 2px;font-family:${C.fontname};
                              font-size:16px;font-weight:700;color:${C.maroon};">
                      ${escapeHtml(senderName)}
                    </p>
                    <p style="margin:0;font-family:${C.fontname};
                              font-size:12px;color:${C.roseGold};">
                      via Aurora Matrimony &nbsp;&middot;&nbsp; Connecting hearts, building futures.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════════════════════════
               FOOTER
               ══════════════════════════════════ -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLight};
                       padding:18px 40px;text-align:center;">
              <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;color:${C.textSecondary};line-height:1.6;">
                This profile was shared with you by a Aurora Matrimony member.
                Questions? &nbsp;
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">
                  Contact support</a>.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                        font-size:11px;color:${C.roseGoldLight};">
                © ${year} Aurora Matrimony. All rights reserved.
              </p>
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

import { shareProfileEmailTemplate } from './share-profile.email.template';

const html = shareProfileEmailTemplate({
  senderName:   'Arjun Sharma',
  receiverName: 'Ravi Kumar',
  profileUrl:   'https://www.suhanamatrimony.com/profile/ishwarya-reddy',
  domain:       'suhanamatrimony.com',
  body:         'I think she is a perfect match for you. Take a look!',

  profile: {
    photoUrl:           'https://storage.googleapis.com/inv-images/profiles/ishwarya.jpg',
    name:               'Ishwarya Reddy',
    dateOfBirth:        '21 Sep 1993',
    age:                32,
    height:             "5'9\"",
    religion:           'Hindu',
    caste:              'Nair',
    occupation:         'Data Scientist',
    annualIncome:       '$140,000',
    education:          'Master\'s Degree',
    motherTongue:       'Malayalam',
    city:               'Orlando, Florida',
    country:            'USA',
    willingToRelocate:  'No',

    // Horoscope — omit or set null to hide entire section
    rasi:               'Mesha',
    nakshatra:          'Ashwini',
    manglik:            'No',

    // Family — omit or set null to hide entire section
    fatherOccupation:   'Retired Government Officer',
    motherOccupation:   'Homemaker',
    siblings:           '1 brother',
    familyNote:         'Looking for a well-educated, family-oriented partner.',
  },
});
*/
