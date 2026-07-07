import { readFileSync } from 'fs';
import { join } from 'path';
 

// ─────────────────────────────────────────────────────────────────────────────
//  SUHANA MATRIMONY — colour tokens
//  Mirrors the :root CSS variables used across the website so emails match
//  the brand exactly. Update here once if the palette ever changes.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  roseGold:        '#b76e79',  // --suhana-rose-gold
  roseGoldLight:   '#d4a0a7',  // --suhana-rose-gold-light
  roseGoldLighter: '#f0d4d8',  // --suhana-rose-gold-lighter
  maroon:          '#a20000',  // --suhana-maroon
  maroonDark:      '#6e0000',  // --suhana-maroon-dark
  ivory:           '#fffff0',  // --suhana-ivory
  ivoryWarm:       '#fdf8f4',  // --suhana-ivory-warm
  gold:            '#c9a84c',  // --suhana-gold
  goldSharp:       '#f0b616',  // --suhana-gold
  goldBright:      '#ffe664',  // --suhana-gold
  goldLight:       '#e8d5a0',  // --suhana-gold-light
  blush:           '#fde8e8',  // --suhana-blush
  textPrimary:     '#3d2c2e',  // --suhana-text-primary
  textSecondary:   '#6b5557',  // --suhana-text-secondary
  shadow:          'rgba(183, 110, 121, 0.15)',          // --suhana-shadow
  gradient:        'linear-gradient(135deg, #b76e79 0%, #a20000 100%)',        // --suhana-gradient
  gradientLight1:  'linear-gradient(135deg, #f0d4d8 0%, #fde8e8 100%)',        // --suhana-gradient-light1
  gradientLight:   'linear-gradient(135deg, #fff0f2 0%, #f2e5e5 100%)',        // --suhana-gradient-light
  fontname:           "'Segoe UI',Arial,sans-serif",  // --suhana-font
};


// ─────────────────────────────────────────────────────────────────────────────
//  Shared helper — reads an SVG from assets and returns a Base64 data URI
//  so images are fully self-contained (no external requests, works in Outlook)
// ─────────────────────────────────────────────────────────────────────────────
function getSvgIconBase64(filename: string, fallbackPath: string): string {
  try {
    const svgPath = join(__dirname, '..', 'assets', 'images', filename);
    return `data:image/svg+xml;base64,${readFileSync(svgPath).toString('base64')}`;
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(fallbackPath).toString('base64')}`;
  }
}

// Heart icon — replaces the old ballot-box "vote" icon for matrimony OTP context
function getHeartIconBase64(): string {
  return getSvgIconBase64(
    'heart-verify.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="white">
      <path d="M12 21s-7.5-4.6-10.1-9.1C.4 9.2 1.2 5.9 4 4.4c2.3-1.2 5-.5 6.5 1.5l1.5 2 1.5-2c1.5-2 4.2-2.7 6.5-1.5 2.8 1.5 3.6 4.8 2.1 7.5C19.5 16.4 12 21 12 21z"/>
    </svg>`,
  );
}

/**
 * Reads the mail SVG from the assets folder and converts it to a Base64
 * data URI so the image is fully self-contained in the email (no external
 * requests, works in every email client including Outlook).
 */
function getMailIconBase64(): string {
  try {
    const svgPath = join(__dirname, '..', 'assets', 'images', 'mail-verify.svg');
    const svgBuffer = readFileSync(svgPath);
    const base64 = svgBuffer.toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    // Fallback: inline SVG data URI with the envelope path hard-coded.
    // Used during local dev if the asset file hasn't been created yet.
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="white">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`;
  }
}

// Sparkle icon — used to highlight a profile match in the interest-request email
function getSparkleIconBase64(): string {
  return getSvgIconBase64(
    'sparkle.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="white">
      <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2zM5 17l.9 2.8L8.5 21l-2.6.8L5 24l-.9-2.2L1.5 21l2.6-1.2L5 17zm14 0l.7 2.1 2.3.7-2.3.7-.7 2.1-.7-2.1-2.3-.7 2.3-.7.7-2.1z"/>
    </svg>`,
  );
}

function encodeImageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Encode each path segment individually so the structure (slashes) stays intact
    url.pathname = url.pathname
      .split('/')
      .map(segment => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return url.toString();
  } catch {
    return rawUrl; // fallback if it's not a valid absolute URL
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  Shared: star rating renderer (filled + empty stars using HTML entities)
// ─────────────────────────────────────────────────────────────────────────────
function renderStars(rating: number, max = 5): string {
  const clamped = Math.max(0, Math.min(max, Math.round(rating)));
  const filled  = '&#9733;'.repeat(clamped);          // ★
  const empty   = '<span style="opacity:0.28;">&#9733;</span>'.repeat(max - clamped);
  return `<span style="color:${C.goldBright};font-size:20px;letter-spacing:3px;">${filled}${empty}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: star rating renderer (filled + empty stars using HTML entities)
// ─────────────────────────────────────────────────────────────────────────────
function renderBodyStars(rating: number, max = 5): string {
  const clamped = Math.max(0, Math.min(max, Math.round(rating)));
  const filled  = '&#9733;'.repeat(clamped);          // ★
  const empty   = '<span style="opacity:0.28;">&#9733;</span>'.repeat(max - clamped);
  return `<span style="color:${C.gold};font-size:20px;letter-spacing:3px;">${filled}${empty}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: section-label pill above data rows
// ─────────────────────────────────────────────────────────────────────────────
function sectionPill(text: string): string {
  return `
  <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;
            font-weight:700;text-transform:uppercase;letter-spacing:1.6px;
            color:${C.roseGold};">${text}</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: single data row — label | value
// ─────────────────────────────────────────────────────────────────────────────
function dataRow(label: string, value: string, isLast = false): string {
  const border = isLast ? '' : `border-bottom:1px solid ${C.roseGoldLighter};`;
  return `
  <tr>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
               color:${C.textSecondary};padding:10px 0;vertical-align:top;
               white-space:nowrap;width:130px;${border}">
      ${label}
    </td>
    <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
               color:${C.textPrimary};padding:10px 0 10px 16px;
               vertical-align:top;${border}">
      ${value}
    </td>
  </tr>`;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Shared: quoted message block with left accent bar
// ─────────────────────────────────────────────────────────────────────────────
function quotedBlock(text: string, label = 'Message'): string {
  return `
  <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;
            font-weight:700;text-transform:uppercase;letter-spacing:1.4px;
            color:${C.roseGold};">${label}</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="4" style="background:${C.maroon};border-radius:2px;"></td>
      <td style="padding:12px 16px;background:${C.ivoryWarm};border-radius:0 8px 8px 0;">
        <p style="margin:0;font-family:${C.fontname};font-size:14px;
                  color:${C.textPrimary};line-height:1.75;font-style:italic;">${text}</p>
      </td>
    </tr>
  </table>`;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Template 1 — Account email verification
//  Sent when a new user registers; contains a clickable link.
// ─────────────────────────────────────────────────────────────────────────────
export const verifyEmailTemplate = (
  code: string,
  userGuid: string,
  firstName: string, 
  domain: string,
): string => {
  const verificationUrl = `${domain}/auth/verifyemail/${userGuid}/${code}`;
  const year            = new Date().getFullYear();
  const mailIconSrc = "https://img.icons8.com/ios-filled/50/ffffff/message-link.png"; //getMailIconBase64();
  const first_name = firstName?.toLocaleLowerCase() === "unknown" ? "User": firstName;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Verify your email – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.ivoryWarm};font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.ivoryWarm};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${C.maroon};background:${C.gradient};
                       padding:44px 40px 36px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.2);
                          border-radius:16px;padding:14px;margin-bottom:20px;">
                <img src="${mailIconSrc}" alt="Email verification"
                     width="40" height="40" style="display:block;border:0;" />
              </div>
              <h1 style="margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;
                         font-size:26px;font-weight:700;color:#ffffff;
                         letter-spacing:-0.3px;">Verify your email address</h1>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;">
                One quick step and you're all set!
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 40px 36px;">
              <p style="margin:0 0 24px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Dear ${first_name},<br/><br/>
                Thanks for signing up for <strong style="color:${C.maroon};">Suhana Matrimony</strong>.
                To activate your account, click the button below. This link is valid for
                <strong>15&nbsp;minutes</strong>.
              </p>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}"
                       style="display:inline-block;
                              background:${C.maroon};background:${C.gradient};
                              color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;
                              padding:16px 48px;border-radius:50px;
                              box-shadow:0 6px 20px rgba(162,0,0,0.35);letter-spacing:0.3px;">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
                <tr>
                  <td style="border-top:1px solid ${C.roseGoldLighter};"></td>
                  <td style="padding:0 14px;white-space:nowrap;font-size:12px;
                             color:${C.roseGold};text-transform:uppercase;letter-spacing:1px;">or use this link</td>
                  <td style="border-top:1px solid ${C.roseGoldLighter};"></td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.blush};border:1px solid ${C.roseGoldLighter};
                             border-radius:10px;padding:14px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;
                               color:${C.roseGold};text-transform:uppercase;letter-spacing:0.8px;">
                      Verification link
                    </p>
                    <a href="${verificationUrl}"
                       style="font-size:12px;color:${C.maroon};word-break:break-all;text-decoration:none;">
                      ${verificationUrl}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info pills -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.goldLight};border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:${C.maroonDark};text-transform:uppercase;letter-spacing:0.7px;">Expires in</p>
                        <p style="margin:0;font-size:14px;color:${C.textPrimary};font-weight:600;">15 minutes</p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.roseGoldLighter};border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:${C.maroon};text-transform:uppercase;letter-spacing:0.7px;">Single use</p>
                        <p style="margin:0;font-size:14px;color:${C.textPrimary};font-weight:600;">One-time link</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="background:${C.ivoryWarm};border-left:4px solid ${C.roseGold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                      <strong>Didn't create an account?</strong>
                      You can safely ignore this email — no account will be activated without clicking the link above.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                This email was sent by <strong style="color:${C.maroon};">Suhana Matrimony</strong>.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">support team</a>.
              </p>
              <p style="margin:0;font-size:11px;color:${C.roseGoldLight};">© ${year} Suhana Matrimony. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};



// ─────────────────────────────────────────────────────────────────────────────
//  Template 2 — Profile / Interest action OTP verification
//
//  In a matrimony platform, an OTP step
//  is used to confirm sensitive, identity-linked actions — e.g. confirming an
//  interest request sent to a profile, or unlocking a profile's contact details.
//  This template covers both via the `actionType` parameter.
// ─────────────────────────────────────────────────────────────────────────────
export const profileActionOtpEmailTemplate = (params: {
  otp:           string;   // 6-digit code  e.g. '503868'
  memberEmail:   string;   // recipient address (shown back to the member for clarity)
  domain:        string;   // for footer support link
  actionType?:   'interest' | 'contact_reveal' | 'profile_update'; // default 'interest'
  matchName?:    string;    // the other member's name, when relevant
  expiresInMinutes?: number; // default 5
}): string => {
 
  const {
    otp,
    memberEmail,
    domain,
    actionType = 'interest',
    matchName,
    expiresInMinutes = 5,
  } = params;
 
  const year         = new Date().getFullYear();
  const heartIconSrc  = getHeartIconBase64();
 
  // Copy varies slightly depending on which action triggered the OTP
  const actionCopy: Record<string, { badge: string; intro: string; selectionLabel: string }> = {
    interest: {
      badge:          'Interest Request',
      intro:          matchName
        ? `We received your interest request for <strong style="color:${C.maroon};">${matchName}</strong>'s profile. `
        : `We received your interest request. `,
      selectionLabel: 'Profile of interest',
    },
    contact_reveal: {
      badge:          'Contact Details',
      intro:          matchName
        ? `We received your request to view contact details for <strong style="color:${C.maroon};">${matchName}</strong>'s profile. `
        : `We received your request to view contact details. `,
      selectionLabel: 'Requested profile',
    },
    profile_update: {
      badge:          'Profile Update',
      intro:          `We received a request to update sensitive details on your profile. `,
      selectionLabel: 'Action requested',
    },
  };
  const copy = actionCopy[actionType] ?? actionCopy.interest;
 
  // Render each OTP digit as an individual styled cell for maximum email-client
  // compatibility (avoids letter-spacing / word-spacing rendering differences)
  const otpCells = otp
    .split('')
    .map(
      (digit) =>
        `<td style="width:52px;height:60px;background:${C.roseGoldLighter};border:2px solid ${C.roseGoldLight};
                    border-radius:12px;text-align:center;vertical-align:middle;
                    font-size:28px;font-weight:800;color:${C.maroon};
                    font-family:'Courier New',monospace;padding:0;">
           ${digit}
         </td>`,
    )
    .join('<td style="width:8px;"></td>'); // gap between cells
 
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your verification code – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:'Segoe UI',Arial,sans-serif;">
 
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr>
      <td align="center">
 
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">
 
          <!-- ── Header ── -->
          <tr>
            <td style="background:${C.maroon};background:${C.gradient};
                       padding:40px 40px 32px;text-align:center;">
 
              <div style="display:inline-block;background:rgba(255,255,255,0.18);
                          border-radius:16px;padding:14px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Verification icon"
                     width="40" height="40" style="display:block;border:0;" />
              </div>
 
              <h1 style="margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;
                         font-size:24px;font-weight:700;color:#ffffff;
                         letter-spacing:-0.3px;">Your Verification Code</h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
                Use the code below to confirm this action on your profile
              </p>
 
              <!-- Gold action-type badge -->
              <div style="display:inline-block;background:rgba(201,168,76,0.22);
                          border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                          padding:6px 18px;margin-top:16px;">
                <span style="font-size:13px;font-weight:600;color:${C.goldLight};
                             letter-spacing:0.3px;">
                  ${copy.badge}
                </span>
              </div>
            </td>
          </tr>
 
          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px;">
 
              <p style="margin:0 0 8px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Hi <strong style="color:${C.textPrimary};">${memberEmail}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                ${copy.intro}
                Please enter the 6-digit code below to confirm and complete this action securely.
              </p>
 
              <!-- ── OTP block ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${C.roseGoldLighter};border:1px solid ${C.roseGoldLight};
                             border-radius:16px;padding:28px 20px;text-align:center;">
 
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;
                               color:${C.maroon};text-transform:uppercase;letter-spacing:1.5px;">
                      Verification Code
                    </p>
 
                    <!-- Individual digit cells -->
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="margin:0 auto 16px;">
                      <tr>${otpCells}</tr>
                    </table>
 
                    <p style="margin:0;font-size:12px;color:${C.textSecondary};line-height:1.5;">
                      Enter this code in the verification window on your Suhana Matrimony account
                    </p>
                  </td>
                </tr>
              </table>
 
              <!-- ── Info pills ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:24px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.goldLight};border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:${C.maroonDark};text-transform:uppercase;letter-spacing:0.7px;">
                          Expires in
                        </p>
                        <p style="margin:0;font-size:14px;color:${C.textPrimary};font-weight:600;">
                          ${expiresInMinutes} minutes
                        </p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.roseGoldLighter};border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:${C.maroon};text-transform:uppercase;letter-spacing:0.7px;">
                          ${copy.selectionLabel}
                        </p>
                        <p style="margin:0;font-size:14px;color:${C.textPrimary};font-weight:600;
                                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          ${matchName ?? 'Your account'}
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
 
              <!-- ── Security / disclaimer note ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:24px;">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0 0 6px;font-size:13px;color:${C.maroonDark};
                               font-weight:700;line-height:1.4;">
                      Didn't request this code?
                    </p>
                    <p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                      If you did not attempt this action, please ignore this email.
                      No changes will be made to your profile or interest requests unless the code is entered.
                    </p>
                  </td>
                </tr>
              </table>
 
              <!-- ── Privacy reminder ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:16px;">
                <tr>
                  <td style="background:${C.ivoryWarm};border-left:4px solid ${C.roseGold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                      <strong style="color:${C.maroon};">Your privacy matters.</strong>
                      Contact details and personal information are only shared once both
                      members have mutually accepted an interest request.
                    </p>
                  </td>
                </tr>
              </table>
 
            </td>
          </tr>
 
          <!-- ── Footer ── -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                       padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                This email was sent by <strong style="color:${C.maroon};">Suhana Matrimony</strong>.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">support team</a>.
              </p>
              <p style="margin:0;font-size:11px;color:${C.roseGoldLight};">
                © ${year} Suhana Matrimony. All rights reserved.
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


// ─────────────────────────────────────────────────────────────────────────────
//  Template 3b — Interest Accepted Notification
//
//  Sent to the original requester (fromUser) when the recipient (toUser)
//  accepts the interest via the email link.
// ─────────────────────────────────────────────────────────────────────────────
export const interestAcceptedEmailTemplate = (params: {
  requesterFirstName: string;
  acceptorFirstName:  string;
  loginUrl:           string;
  domain:             string;
}): string => {
  const { requesterFirstName, acceptorFirstName, loginUrl, domain } = params;
  const year         = new Date().getFullYear();
  const heartIconSrc = 'https://storage.googleapis.com/inv-images/home/fav-flrnd.png';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your Interest Has Been Accepted – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:${C.gradient};padding:44px 40px 36px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.78);
                          border-radius:50px;padding:3px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Heart" width="60" height="60"
                     style="display:block;border:0;" />
              </div>
              <h1 style="margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;
                         font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                Great News, ${requesterFirstName}! 🎉
              </h1>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.87);line-height:1.5;">
                Your interest request has been accepted
              </p>
              <div style="display:inline-block;background:rgba(201,168,76,0.22);
                          border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                          padding:6px 18px;margin-top:16px;">
                <span style="font-size:13px;font-weight:600;color:${C.goldLight};letter-spacing:0.3px;">
                  &#10084; Interest Accepted
                </span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 40px 36px;">
              <p style="margin:0 0 20px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Hi <strong>${requesterFirstName}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Good news! <strong style="color:${C.maroon};">${acceptorFirstName}</strong> has
                accepted your interest request on <strong>Suhana Matrimony</strong>.
                You can now log in to continue the conversation and view their full profile.
              </p>

              <!-- Highlight card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:${C.roseGoldLighter};border:1px solid ${C.roseGoldLight};
                             border-radius:16px;padding:24px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;
                               color:${C.maroon};text-transform:uppercase;letter-spacing:0.8px;">
                      Accepted by
                    </p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:${C.maroonDark};">
                      ${acceptorFirstName}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;background:${C.gradient};color:#ffffff;
                              text-decoration:none;font-size:16px;font-weight:700;
                              padding:16px 48px;border-radius:50px;
                              box-shadow:0 6px 20px rgba(162,0,0,0.35);letter-spacing:0.3px;">
                      &#128172; Start Conversation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Privacy note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:${C.maroonDark};line-height:1.6;">
                      <strong>Your connection is now active.</strong>
                      <span style="color:${C.textSecondary};">
                        You and ${acceptorFirstName} can now exchange messages and view each other's contact details.
                      </span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                       padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                This email was sent by <strong style="color:${C.maroon};">Suhana Matrimony</strong>.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">support team</a>.
              </p>
              <p style="margin:0;font-size:11px;color:${C.roseGoldLight};">
                © ${year} Suhana Matrimony. All rights reserved.
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


// ─────────────────────────────────────────────────────────────────────────────
//  Template 3 — Interest Request Notification
//
//  Sent to a member (the "recipient") when another member (the "sender")
//  views their profile and sends an interest request. This is the very first
//  touchpoint between two prospective matches, so the tone is warm, respectful,
//  and reassuring about privacy — with a clear, low-friction call to action.
// ─────────────────────────────────────────────────────────────────────────────
export const interestRequestEmailTemplate = (params: {
  recipientFirstName:  string;   // person receiving this email (User2)
  senderFirstName:     string;   // person who expressed interest (User1)
  senderProfileId?:    string;   // e.g. "SUH10234" — optional, shown as a badge
  senderAge?:          number;
  senderLocation?:     string;
  senderProfession?:   string;
  senderPhotoUrl?:     string;   // if provided, shown as round avatar; else initials fallback
  acceptUrl:           string;   // deep link to accept the request
  viewProfileUrl:      string;   // deep link to view the sender's full profile
  domain:              string;   // for footer support link
}): string => {
 
  const {
    recipientFirstName,
    senderFirstName,
    senderProfileId,
    senderAge,
    senderLocation,
    senderProfession,
    senderPhotoUrl,
    acceptUrl,
    viewProfileUrl,
    domain,
  } = params;
 
  const year           = new Date().getFullYear();

  const sparkleIconSrc  = getSparkleIconBase64();
  const initial         = senderFirstName.trim().charAt(0).toUpperCase() || '?';
  const heartIconSrc  = "https://storage.googleapis.com/inv-images/home/fav-flrnd.png"; //getHeartIconBase64();
  const safePhotoUrl = encodeImageUrl(senderPhotoUrl);

  // Build the small meta line under the sender's name, e.g. "29 yrs · Chennai · Software Engineer"
  const metaParts = [
    senderAge ? `${senderAge} yrs` : null,
    senderLocation || null,
    senderProfession || null,
  ].filter(Boolean);
  const metaLine = metaParts.join(' &nbsp;&middot;&nbsp; ');
 
  // Avatar — photo if available, else a rose-gold initial circle
  const avatarHtml = safePhotoUrl
    ? `<img src="${safePhotoUrl}" alt="${senderFirstName}"
            width="72" height="72"
            style="display:block;width:72px;height:72px;border-radius:50%;
                   object-fit:cover;border:3px solid ${C.goldLight};" />`
    : `<table cellpadding="0" cellspacing="0" border="0" width="72" height="72"
              style="background:${C.maroon};background:${C.gradient};
                     border-radius:50%;border:3px solid ${C.goldLight};">
         <tr><td align="center" valign="middle"
                 style="font-family:'Segoe UI',Arial,sans-serif;
                        font-size:30px;font-weight:700;color:#ffffff;">
           ${initial}
         </td></tr>
       </table>`;
 
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${senderFirstName} is interested in your profile – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:'Segoe UI',Arial,sans-serif;">
 
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr>
      <td align="center">
 
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">
 
          <!-- ── Header ── -->
          <tr>
            <td style="background:${C.maroon};background:${C.gradient};
                       padding:40px 40px 32px;text-align:center;">
 
              <!--<div style="display:inline-block;background:rgba(255,255,255,0.18);
                          border-radius:16px;padding:14px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Interest request"
                     width="40" height="40" style="display:block;border:0;" />
              </div>-->
              
              <div style="display:inline-block;background:rgba(255,255,255,0.78);
                          border-radius:50px;padding:3px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Verification icon"
                     width="60" height="60" style="display:block;border:0;" />
              </div>              
 
              <h1 style="margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;
                         font-size:24px;font-weight:700;color:#ffffff;
                         letter-spacing:-0.3px;">
                You Have a New Interest Request!
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
                Someone special noticed your profile
              </p>
 
              <!-- Gold "New Connection" badge -->
              <div style="display:inline-block;background:rgba(201,168,76,0.22);
                          border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                          padding:6px 18px;margin-top:16px;">
                <span style="font-size:13px;font-weight:600;color:${C.goldLight};
                             letter-spacing:0.3px;">
                  &#10024; New Connection Request
                </span>
              </div>
            </td>
          </tr>
 
          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 8px;">
 
              <p style="margin:0 0 8px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Dear <strong>${recipientFirstName}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:${C.textPrimary};line-height:1.7;">
                Great news! <strong style="color:${C.maroon};">${senderFirstName}</strong>
                came across your profile on <strong>Suhana Matrimony</strong> and felt a genuine
                connection. They have sent you an interest request and are hoping to get to
                know you better.
              </p>
 
              <!-- ── Sender profile card ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${C.roseGoldLighter};
                             border:1px solid ${C.roseGoldLight};border-radius:16px;
                             padding:24px;">
 
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <!-- Avatar -->
                        <td width="72" valign="top" style="padding-right:18px;">
                          ${avatarHtml}
                        </td>
 
                        <!-- Name + meta -->
                        <td valign="middle">
                          <p style="margin:0 0 4px;font-family:'Segoe UI',Arial,sans-serif;
                                    font-size:19px;font-weight:700;color:${C.maroonDark};">
                            ${senderFirstName}
                            ${senderProfileId ? `
                            <span style="display:inline-block;margin-left:8px;
                                         background:#dfc096;color:${C.maroonDark};
                                         font-family:Arial,Helvetica,sans-serif;
                                         font-size:10px;font-weight:700;letter-spacing:0.4px;
                                         padding:5px 9px 3px 9px;border-radius:50px;vertical-align:middle;">
                              ID: ${senderProfileId}
                            </span>` : ''}
                          </p>
                          ${metaLine ? `
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                                    font-size:13px;color:${C.textSecondary};line-height:1.5;">
                            ${metaLine}
                          </p>` : ''}
                        </td>
                      </tr>
                    </table>
 
                    <!-- Personal note line -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                      <tr>
                        <td style="background:#ffffff;border-left:3px solid ${C.maroon};
                                   border-radius:8px;padding:14px 16px;">
                          <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;
                                    font-size:14px;font-style:italic;color:${C.textPrimary};
                                    line-height:1.6;">
                            &ldquo;I came across your profile and would really love the chance
                            to connect and know more about you. I hope you'll consider
                            accepting my request so we can talk further.&rdquo;
                          </p>
                        </td>
                      </tr>
                    </table>
 
                  </td>
                </tr>
              </table>
 
              <!-- ── CTA buttons ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <a href="${acceptUrl}"
                             style="display:inline-block;
                                    background:${C.maroon};background:${C.gradient};
                                    color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;
                                    font-size:15px;font-weight:700;
                                    padding:15px 36px;border-radius:50px;
                                    box-shadow:0 6px 20px rgba(162,0,0,0.35);letter-spacing:0.3px;">
                            &#10084;&nbsp; Accept Request
                          </a>
                        </td>
                        <td>
                          <a href="${viewProfileUrl}"
                             style="display:inline-block;
                                    background:#ffffff;color:${C.maroon};text-decoration:none;
                                    font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;
                                    padding:14px 30px;border-radius:50px;
                                    border:2px solid ${C.roseGoldLight};letter-spacing:0.3px;">
                            View Profile
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
 
              <p style="margin:0 0 28px;font-size:12px;color:${C.textSecondary};
                        text-align:center;line-height:1.5;">
                You can also log in to your account anytime to review and respond to this request.
              </p>
 
              <!-- ── Why connect — encouragement strip ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:${C.ivoryWarm};border-radius:12px;padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="32" valign="top">
                          <img src="${sparkleIconSrc}" alt=""
                               width="20" height="20"
                               style="display:block;filter:invert(0.3) sepia(1) saturate(3) hue-rotate(-20deg);" />
                        </td>
                        <td style="padding-left:6px;">
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                                    font-size:13px;color:${C.textSecondary};line-height:1.65;">
                            <strong style="color:${C.maroonDark};">Every great match starts with a single &ldquo;yes.&rdquo;</strong>
                            Accepting an interest request simply opens the door to a conversation —
                            you're always in control of what you share and when.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
 
              <!-- ── Privacy reassurance ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:${C.maroonDark};line-height:1.6;">
                      <strong>Your privacy is always protected.</strong>
                      <span style="color:${C.textSecondary};">
                        Contact details remain hidden until both you and ${senderFirstName}
                        choose to accept the connection.
                      </span>
                    </p>
                  </td>
                </tr>
              </table>
 
            </td>
          </tr>
 
          <!-- ── Footer ── -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                       padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:${C.textSecondary};line-height:1.6;">
                This email was sent by <strong style="color:${C.maroon};">Suhana Matrimony</strong>
                because someone showed interest in your profile.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">support team</a>.
              </p>
              <p style="margin:0;font-size:11px;color:${C.roseGoldLight};">
                © ${year} Suhana Matrimony. All rights reserved.
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


// ─────────────────────────────────────────────────────────────────────────────
//  Template 4 — feedbackAdminNotificationTemplate
//  Sent to the admin inbox whenever a member submits feedback.
// ─────────────────────────────────────────────────────────────────────────────
export const feedbackAdminNotificationTemplate = (params: {
  submitterName:  string;   // e.g. "Arjun Sharma"
  submitterEmail: string;
  category:       string;   // e.g. "PREMIUM BILLING"
  rating?:        number;   // 1-5
  subject:        string;
  message:        string;
  feedbackId:     string;
  adminPanelUrl:  string;
  domain:         string;
  submittedAt?:   Date;
  isAnonymous: boolean;
}): string => {

  const {
    submitterName, submitterEmail, category,
    rating, subject, message,
    feedbackId, adminPanelUrl, domain,
  } = params;

  const displayName = params.isAnonymous ? 'Anonymous User' : params.submitterName;
  const year      = new Date().getFullYear();
  const timestamp = (params.submittedAt ?? new Date()).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });

  // Truncate long messages for the admin preview
  const preview = message.length > 220 ? message.slice(0, 220) + '…' : message;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>New Feedback – Suhana Matrimony Admin</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:36px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:20px;
                    box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${C.maroon};background:${C.gradient};
                     padding:36px 40px 28px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">&#128203;</div>
            <h1 style="margin:0 0 6px;font-family:${C.fontname};
                       font-size:22px;font-weight:700;color:#ffffff;">
              New Feedback Received
            </h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.5;">
              A member has submitted feedback on Suhana Matrimony
            </p>
            <!-- Alert strip -->
            <div style="display:inline-block;margin-top:14px;background:rgba(201,168,76,0.22);
                        border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                        padding:5px 16px;">
              <span style="font-size:12px;font-weight:600;
                           color:${C.goldLight};letter-spacing:0.3px;
                           font-family:Arial,Helvetica,sans-serif;">
                &#128276;&nbsp; Action Required
              </span>
            </div>
          </td>
        </tr>

        <!-- Submission timestamp pill -->
        <tr>
          <td style="background:${C.roseGoldLighter};padding:10px 40px;
                     border-bottom:1px solid ${C.roseGoldLight};">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                      color:${C.maroonDark};font-weight:600;text-align:center;">
              &#128337;&nbsp; Submitted: ${timestamp} IST
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">

            <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;color:${C.textPrimary};line-height:1.7;">
              Hello <strong>Admin</strong>,<br/>
              A new feedback has been submitted on <strong style="color:${C.maroon};">Suhana Matrimony</strong>.
              Please review the details below and take appropriate action.
            </p>

            <!-- Feedback data table -->
            <div style="background:${C.ivoryWarm};border-radius:12px;
                        border:1px solid ${C.roseGoldLighter};padding:20px 22px;
                        margin-bottom:24px;">
              ${sectionPill('Submission Details')}
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${dataRow('Submitted By',
                  `${displayName}
                   <br/><span style="font-size:12px;color:${C.textSecondary};">
                     <a href="mailto:${submitterEmail}"
                        style="color:${C.maroon};text-decoration:none;">${submitterEmail}</a>
                   </span>`)}
                ${dataRow('Category',
                  `<span style="background:${C.roseGoldLighter};color:${C.maroonDark};
                               border-radius:50px;padding:2px 10px;font-size:12px;
                               font-weight:700;">${category}</span>`)}
                ${dataRow('Rating',
                  rating !== undefined ? renderBodyStars(rating) : '—')}
                ${dataRow('Subject', `<strong>${subject}</strong>`)}
                ${dataRow('Feedback ID',
                  `<code style="font-size:11px;color:${C.textSecondary};
                                background:${C.roseGoldLighter};padding:2px 8px;
                                border-radius:4px;">${feedbackId}</code>`, true)}
              </table>
            </div>

            <!-- Message preview -->
            <div style="margin-bottom:28px;">
              ${quotedBlock(preview, 'Message Preview')}
            </div>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <a href="${adminPanelUrl}"
                     style="display:inline-block;
                            background:${C.maroon};background:${C.gradient};
                            color:#ffffff;text-decoration:none;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;font-weight:700;
                            padding:14px 36px;border-radius:50px;
                            box-shadow:0 6px 20px rgba(162,0,0,0.32);
                            letter-spacing:0.3px;">
                    &#128274;&nbsp; Open Admin Panel
                  </a>
                </td>
              </tr>
            </table>

            <!-- Reminder strip -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
              <tr>
                <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                           border-radius:6px;padding:13px 18px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;color:${C.maroonDark};line-height:1.6;">
                    <strong>Reminder:</strong> Please log in to the admin panel to review
                    and take action on this feedback.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                     padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:${C.textSecondary};
                      font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
              Internal notification — <strong style="color:${C.maroon};">Suhana Matrimony</strong>
              Admin System &nbsp;&bull;&nbsp;
              <a href="mailto:support@${domain}"
                 style="color:${C.maroon};text-decoration:none;font-weight:600;">support@${domain}</a>
            </p>
            <p style="margin:0;font-size:11px;color:${C.roseGoldLight};
                      font-family:Arial,Helvetica,sans-serif;">
              © ${year} Suhana Matrimony. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};


// ─────────────────────────────────────────────────────────────────────────────
//  Template 5 — feedbackThankYouTemplate
//  Sent to the member who submitted feedback, confirming receipt.
// ─────────────────────────────────────────────────────────────────────────────
export const feedbackThankYouTemplate = (params: {
  userName:   string;
  category:    string;
  subject:     string;
  rating?:     number;
  feedbackId?: string;
  domain:      string;
}): string => {

  const { userName, category, subject, rating, feedbackId, domain } = params;
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Thank You for Your Feedback – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.ivoryWarm};font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.ivoryWarm};padding:40px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:20px;
                    box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${C.maroon};background:${C.gradient};
                     padding:40px 40px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:12px;">&#128149;</div>
            <h1 style="margin:0 0 8px;font-family:${C.fontname};
                       font-size:23px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              Thank You for Your Feedback
            </h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
              Your voice helps us build a better experience for everyone
            </p>
            ${rating !== undefined ? `
            <div style="margin-top:16px;">${renderStars(rating)}</div>` : ''}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 28px;">

            <p style="margin:0 0 8px;font-size:16px;color:${C.textPrimary};line-height:1.7;">
              Dear <strong>${userName}</strong>,
            </p>
            <div style="width:40px;height:3px;background:${C.gradient};
                        border-radius:2px;margin:0 0 20px;"></div>

            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;color:${C.textPrimary};line-height:1.8;">
              Thank you for taking the time to share your feedback with us. Your
              opinion matters greatly and helps us improve the
              <strong style="color:${C.maroon};">Suhana Matrimony</strong> experience
              for every member of our community.
            </p>

            <!-- Submission summary box -->
            <div style="background:${C.roseGoldLighter};border-radius:12px;
                        border:1px solid ${C.roseGoldLight};padding:20px 22px;
                        margin-bottom:24px;">
              ${sectionPill('Your Submission')}
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${dataRow('Subject',  `<strong>${subject}</strong>`)}
                ${dataRow('Category',
                  `<span style="background:#ffffff;color:${C.maroonDark};
                               border-radius:50px;padding:2px 10px;font-size:12px;
                               font-weight:700;">${category}</span>`)}
                ${feedbackId ? dataRow('Reference ID',
                  `<code style="font-size:11px;color:${C.textSecondary};
                                background:#ffffff;padding:2px 8px;
                                border-radius:4px;">${feedbackId}</code>`, true)
                  : ''}
              </table>
            </div>

            <!-- What happens next checklist -->
            <div style="background:${C.ivoryWarm};border-radius:12px;
                        border:1px solid ${C.roseGoldLighter};padding:20px 22px;
                        margin-bottom:28px;">
              ${sectionPill('What Happens Next')}
              ${[
                ['Our team reviews', `your feedback and categorises it for the right team.`],
                ['We take action',   `where possible we update our processes based on your input.`],
                ['We reply',        `if your feedback requires a personal response, we will email you.`],
              ].map(([title, desc], i) => `
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:${i < 2 ? '10px' : '0'};">
                <tr>
                  <td width="28" valign="top">
                    <div style="width:24px;height:24px;border-radius:50%;
                                background:${C.gradient};text-align:center;line-height:24px;
                                font-family:Arial,Helvetica,sans-serif;font-size:11px;
                                font-weight:700;color:#ffffff;">${i + 1}</div>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
                                 color:${C.textPrimary};line-height:1.5;">
                      <strong style="color:${C.maroonDark};">${title}</strong> — ${desc}
                    </span>
                  </td>
                </tr>
              </table>`).join('')}
            </div>

            <!-- Gold reassurance bar -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                           border-radius:6px;padding:13px 18px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;color:${C.maroonDark};line-height:1.6;">
                    We have received your feedback and our team will review it shortly.
                    If your feedback requires a response, we will get back to you as soon as possible.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                     padding:22px 40px;">
            <p style="margin:0 0 3px;font-family:${C.fontname};
                      font-size:15px;color:${C.textPrimary};">Warm regards,</p>
            <p style="margin:0 0 2px;font-family:${C.fontname};
                      font-size:16px;font-weight:700;color:${C.maroon};">
              The Suhana Matrimony Team
            </p>
            <p style="margin:0;font-family:${C.fontname};
                      font-size:12px;color:${C.roseGold};">
              Connecting hearts, building futures.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${C.roseGoldLighter};border-top:1px solid ${C.roseGoldLight};
                     padding:16px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${C.textSecondary};
                      font-family:Arial,Helvetica,sans-serif;">
              Questions? &nbsp;
              <a href="mailto:support@${domain}"
                 style="color:${C.maroon};text-decoration:none;font-weight:600;">support@${domain}</a>
            </p>
            <p style="margin:0;font-size:11px;color:${C.roseGoldLight};
                      font-family:Arial,Helvetica,sans-serif;">
              © ${year} Suhana Matrimony. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};


// ─────────────────────────────────────────────────────────────────────────────
//  Template 6 — profileFeedbackNotificationTemplate
//  Sent to a member when another member (or anonymous) leaves feedback
//  specifically on their profile.
// ─────────────────────────────────────────────────────────────────────────────
export const profileFeedbackNotificationTemplate = (params: {
  targetName:   string;    // profile owner who receives this email
  reviewerName: string;    // person who left the feedback
  isAnonymous:  boolean;   // if true, reviewer name is hidden
  category:     string;    // feedback type e.g. "PROFILE_QUALITY"
  subject:      string;
  rating?:      number;
  loginUrl:     string;    // deep link to the member's profile page
  domain:       string;
}): string => {

  const { targetName, reviewerName, isAnonymous,
          category, subject, rating, loginUrl, domain } = params;

  const year = new Date().getFullYear();

  // This mirrors the reviewerDisplay logic from the caller's snippet
  const reviewerDisplay = isAnonymous ? 'a Suhana member' : reviewerName;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>New Feedback on Your Profile – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:20px;
                    box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${C.maroon};background:${C.gradient};
                     padding:40px 40px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:12px;">&#11088;</div>
            <h1 style="margin:0 0 8px;font-family:${C.fontname};
                       font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              New Feedback On Your Profile
            </h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
              A member shared their thoughts about your profile
            </p>
            ${rating !== undefined ? `
            <div style="margin-top:14px;">${renderStars(rating)}</div>` : ''}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 28px;">

            <p style="margin:0 0 6px;font-size:16px;color:${C.textPrimary};line-height:1.7;">
              Dear <strong>${targetName}</strong>,
            </p>
            <div style="width:40px;height:3px;background:${C.gradient};
                        border-radius:2px;margin:0 0 20px;"></div>

            <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;color:${C.textPrimary};line-height:1.8;">
              You have received new feedback from
              <strong style="color:${C.maroon};">${reviewerDisplay}</strong>
              on your <strong>Suhana Matrimony</strong> profile.
            </p>

            <!-- Feedback summary card -->
            <div style="background:${C.roseGoldLighter};border-radius:12px;
                        border:1px solid ${C.roseGoldLight};padding:20px 22px;
                        margin-bottom:24px;">
              ${sectionPill('Feedback Details')}
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${dataRow('Type',
                  `<span style="background:#ffffff;color:${C.maroonDark};
                               border-radius:50px;padding:2px 10px;font-size:12px;
                               font-weight:700;">${category.replace(/_/g, ' ')}</span>`)}
                ${dataRow('Subject', `<strong>${subject}</strong>`)}
                ${rating !== undefined
                  ? dataRow('Rating', renderBodyStars(rating), true)
                  : ''}
              </table>
            </div>

            <!-- Moderation note -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:28px;">
              <tr>
                <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                           border-radius:6px;padding:14px 18px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;color:${C.maroonDark};line-height:1.65;">
                    <strong>&#128274;&nbsp; Under review.</strong>
                    Feedback is reviewed by our moderation team before it appears on your profile.
                    Once approved, it will be visible to other members if marked as public.
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
              <tr>
                <td align="center">
                  <a href="${loginUrl}"
                     style="display:inline-block;
                            background:${C.maroon};background:${C.gradient};
                            color:#ffffff;text-decoration:none;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;font-weight:700;
                            padding:14px 36px;border-radius:50px;
                            box-shadow:0 6px 20px rgba(162,0,0,0.32);
                            letter-spacing:0.3px;">
                    &#128100;&nbsp; View My Profile
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:${C.ivoryWarm};border-top:1px solid ${C.roseGoldLighter};
                     padding:22px 40px;">
            <p style="margin:0 0 3px;font-family:${C.fontname};
                      font-size:15px;color:${C.textPrimary};">Warm regards,</p>
            <p style="margin:0 0 2px;font-family:${C.fontname};
                      font-size:16px;font-weight:700;color:${C.maroon};">
              The Suhana Matrimony Team
            </p>
            <p style="margin:0;font-family:${C.fontname};
                      font-size:12px;color:${C.roseGold};">
              Connecting hearts, building futures.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLight};
                     padding:16px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${C.textSecondary};
                      font-family:Arial,Helvetica,sans-serif;">
              You received this because feedback was left on your Suhana Matrimony profile. &nbsp;
              <a href="mailto:support@${domain}"
                 style="color:${C.maroon};text-decoration:none;font-weight:600;">
                Contact support</a>
            </p>
            <p style="margin:0;font-size:11px;color:${C.roseGoldLight};
                      font-family:Arial,Helvetica,sans-serif;">
              © ${year} Suhana Matrimony. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};


// ─────────────────────────────────────────────────────────────────────────────
//  Template 7 — feedbackReplyTemplate
//  Sent to the original feedback submitter when the admin (or team) replies.
// ─────────────────────────────────────────────────────────────────────────────
export const feedbackReplyTemplate = (params: {
  userName:        string;   // original feedback submitter
  repliedBy:       string;   // admin/team member who replied, e.g. "Priya from Suhana Team"
  originalSubject: string;
  originalMessage?: string;  // optional — truncated preview of their original feedback
  replyMessage:    string;
  feedbackId?:     string;
  loginUrl?:       string;   // optional CTA to continue the conversation
  domain:          string;
}): string => {

  const {
    userName, repliedBy, originalSubject,
    originalMessage, replyMessage,
    feedbackId, loginUrl, domain,
  } = params;

  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>We Replied to Your Feedback – Suhana Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.ivoryWarm};font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.ivoryWarm};padding:40px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:20px;
                    box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${C.maroon};background:${C.gradient};
                     padding:40px 40px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:12px;">&#128172;</div>
            <h1 style="margin:0 0 8px;font-family:${C.fontname};
                       font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              We Replied to Your Feedback
            </h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
              A response from the Suhana Matrimony team
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 28px;">

            <p style="margin:0 0 6px;font-size:16px;color:${C.textPrimary};line-height:1.7;">
              Dear <strong>${userName}</strong>,
            </p>
            <div style="width:40px;height:3px;background:${C.gradient};
                        border-radius:2px;margin:0 0 20px;"></div>

            <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;color:${C.textPrimary};line-height:1.8;">
              We have reviewed your feedback and
              <strong style="color:${C.maroon};">${repliedBy}</strong>
              has sent you a response. Thank you for your patience.
            </p>

            <!-- Your original feedback -->
            <div style="margin-bottom:20px;">
              ${sectionPill('Your Feedback')}
              <div style="background:${C.roseGoldLighter};border-radius:10px;
                          border:1px solid ${C.roseGoldLight};padding:14px 18px;">
                <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;font-weight:700;color:${C.textPrimary};">
                  ${originalSubject}
                </p>
                ${originalMessage ? `
                <p style="margin:0;font-family:${C.fontname};
                          font-size:13px;color:${C.textSecondary};
                          font-style:italic;line-height:1.65;">
                  ${originalMessage.length > 160 ? originalMessage.slice(0, 160) + '…' : originalMessage}
                </p>` : ''}
                ${feedbackId ? `
                <p style="margin:6px 0 0;font-family:${C.fontname};font-size:11px;
                          color:${C.roseGoldLight};">
                  Ref: <code style="background:#ffffff;padding:1px 6px;border-radius:4px;">${feedbackId}</code>
                </p>` : ''}
              </div>
            </div>

            <!-- Our Response (hero block) -->
            <div style="margin-bottom:28px;">
              ${quotedBlock(replyMessage, 'Our Response')}
            </div>

            <!-- Thank you strip -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:${loginUrl ? '24px' : '0'};">
              <tr>
                <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                           border-radius:6px;padding:14px 18px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;color:${C.maroonDark};line-height:1.6;">
                    <strong>Thank you for helping us improve Suhana Matrimony.</strong>
                    Your feedback is invaluable to us and every suggestion helps shape
                    a better experience for all our members.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Optional CTA -->
            ${loginUrl ? `
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center">
                  <a href="${loginUrl}"
                     style="display:inline-block;
                            background:${C.maroon};background:${C.gradient};
                            color:#ffffff;text-decoration:none;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;font-weight:700;
                            padding:14px 36px;border-radius:50px;
                            box-shadow:0 6px 20px rgba(162,0,0,0.3);
                            letter-spacing:0.3px;">
                    Continue on Suhana Matrimony
                  </a>
                </td>
              </tr>
            </table>` : ''}

          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                     padding:22px 40px;">
            <p style="margin:0 0 3px;font-family:${C.fontname};
                      font-size:15px;color:${C.textPrimary};">Warm regards,</p>
            <p style="margin:0 0 2px;font-family:${C.fontname};
                      font-size:16px;font-weight:700;color:${C.maroon};">
              The Suhana Matrimony Team
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                      font-size:12px;color:${C.roseGold};">
              Connecting hearts, building futures.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${C.roseGoldLighter};border-top:1px solid ${C.roseGoldLight};
                     padding:16px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${C.textSecondary};
                      font-family:Arial,Helvetica,sans-serif;">
              © ${year} Suhana Matrimony &nbsp;&bull;&nbsp;
              Response to your submitted feedback &nbsp;&bull;&nbsp;
              <a href="mailto:support@${domain}"
                 style="color:${C.maroon};text-decoration:none;font-weight:600;">
                support@${domain}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
//  Template 8 — shareProfileEmailTemplate
//
//  Sent when a Suhana Matrimony member shares another member's profile link
//  with someone — could be a friend, family member, or another member.
//
//  Accepts:
//    senderName    — person doing the sharing (appears in sign-off)
//    receiverName  — person receiving this email (appears in greeting)
//    profileUrl    — the full URL to the shared profile
//    subject       — optional custom subject line text (default provided)
//    body          — optional personal message from the sender (shown as a
//                    quoted note; if omitted, a warm default is used)
//    domain        — used for footer support link
// ─────────────────────────────────────────────────────────────────────────────
export const shareProfileEmailTemplate = (params: {
  senderName:    string;
  receiverName:  string;
  profileUrl:    string;
  subject?:      string;
  body?:         string;
  domain:        string;
}): string => {

  const { senderName, receiverName, profileUrl, domain } = params;
  const year = new Date().getFullYear();
  const heartIconSrc  = "https://storage.googleapis.com/inv-images/home/fav-flrnd.png";

  // Encode the profile URL defensively so spaces/special chars in the
  // GCS filename never produce a broken href (see image-url encoding note)
  const safeUrl = (() => {
    try {
      const u = new URL(profileUrl);
      u.pathname = u.pathname
        .split('/')
        .map(seg => encodeURIComponent(decodeURIComponent(seg)))
        .join('/');
      return u.toString();
    } catch {
      return profileUrl;
    }
  })();

  // Personal message — use caller's text or a warm default
  const personalNote = (params.body ?? '').trim()
    || `I came across this profile on Suhana Matrimony and thought it might be a great match for you. Take a look and let me know what you think!`;

  // Email subject line — caller can override
  const emailSubject = (params.subject ?? '').trim()
    || `${senderName} shared a profile with you on Suhana Matrimony`;

  // Sender initial for the sign-off avatar
  const initial = senderName.trim().charAt(0).toUpperCase() || 'S';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${emailSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};
             font-family:${C.fontname};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr><td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:20px;
                    box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

        <!-- ════════════════════════════
             HEADER — same gradient & icon
             pattern as every other template
             ════════════════════════════ -->
        <tr>
          <td style="background:${C.maroon};background:${C.gradient};
                     padding:40px 40px 32px;text-align:center;">

            <!-- Share icon inside frosted circle -->
              <div style="display:inline-block;background:rgba(255,255,255,0.78);
                          border-radius:50px;padding:3px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Verification icon"
                     width="60" height="60" style="display:block;border:0;" />
              </div>                        

            <h1 style="margin:0 0 8px;font-family:${C.fontname};
                       font-size:24px;font-weight:700;color:#ffffff;
                       letter-spacing:-0.3px;">
              Someone Shared a Profile With You!
            </h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;font-family:${C.fontname};">
              A Suhana Matrimony member thinks this could be your perfect match
            </p>

            <!-- Gold badge -->
            <div style="display:inline-block;background:rgba(201,168,76,0.22);
                        border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                        padding:6px 18px;margin-top:16px;">
              <span style="font-size:12px;font-weight:600;
                           color:${C.goldLight};letter-spacing:0.3px;
                           font-family:Arial,Helvetica,sans-serif;">
                &#10024;&nbsp; Shared by ${senderName}
              </span>
            </div>
          </td>
        </tr>

        <!-- ════════════════
             BODY
             ════════════════ -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px;font-size:16px;color:${C.textPrimary};
                      line-height:1.7;">
              Dear <strong>${receiverName}</strong>,
            </p>
            <div style="width:40px;height:3px;background:${C.gradient};
                        border-radius:2px;margin:0 0 20px;"></div>

            <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:15px;color:${C.textPrimary};line-height:1.8;">
              <strong style="color:${C.maroon};">${senderName}</strong>
              would like to share a profile from
              <strong>Suhana Matrimony</strong> with you.
            </p>

            <!-- Personal note from sender — left-bordered quote -->
            <div style="margin-bottom:28px;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;font-weight:700;text-transform:uppercase;
                        letter-spacing:1.4px;color:${C.roseGold};">
                Message from ${senderName}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="4" style="background:${C.maroon};border-radius:2px;"></td>
                  <td style="padding:14px 18px;background:${C.ivoryWarm};
                             border-radius:0 10px 10px 0;
                             border:1px solid ${C.roseGoldLighter};
                             border-left:none;">
                    <p style="margin:0;font-family:${C.fontname};
                              font-size:14px;color:${C.textPrimary};
                              font-style:italic;line-height:1.75;">
                      &ldquo;${personalNote}&rdquo;
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Profile URL display box -->
            <div style="background:${C.roseGoldLighter};border-radius:12px;
                        border:1px solid ${C.roseGoldLight};padding:20px 22px;
                        margin-bottom:28px;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;
                        font-size:10px;font-weight:700;text-transform:uppercase;
                        letter-spacing:1.4px;color:${C.roseGold};">
                Shared Profile Link
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
                <a href="${safeUrl}"
                   style="color:${C.maroon};text-decoration:none;
                          word-break:break-all;font-weight:600;">
                  ${safeUrl}
                </a>
              </p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;
                        font-size:11px;color:${C.textSecondary};">
                Click the link or use the button below to view the profile
              </p>
            </div>

            <!-- Primary CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${safeUrl}"
                     style="display:inline-block;
                            background:${C.maroon};background:${C.gradient};
                            color:#ffffff;text-decoration:none;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:15px;font-weight:700;
                            padding:15px 40px;border-radius:50px;
                            box-shadow:0 6px 20px rgba(162,0,0,0.32);
                            letter-spacing:0.3px;">
                    &#128100;&nbsp; View Profile
                  </a>
                </td>
              </tr>
            </table>

            <!-- Privacy note -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                           border-radius:6px;padding:13px 18px;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;color:${C.maroonDark};line-height:1.65;">
                    <strong>&#128274;&nbsp; Your privacy is protected.</strong>
                    <span style="color:${C.textSecondary};">
                      Contact details are only shared once both members choose
                      to connect on Suhana Matrimony.
                    </span>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ════════════════
             SIGN-OFF — sender's
             name + initial avatar
             ════════════════ -->
        <tr>
          <td style="background:${C.ivoryWarm};border-top:1px solid ${C.roseGoldLighter};
                     padding:24px 40px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Sender initial circle -->
                <td width="44" valign="middle" style="padding-right:14px;">
                  <div style="width:40px;height:40px;border-radius:50%;
                              background:${C.maroon};background:${C.gradient};
                              text-align:center;line-height:40px;
                              font-family:${C.fontname};
                              font-size:18px;font-weight:700;color:#ffffff;">
                    ${initial}
                  </div>
                </td>
                <!-- Text -->
                <td valign="middle">
                  <p style="margin:0 0 2px;font-family:${C.fontname};
                            font-size:14px;color:${C.textSecondary};">
                    Shared with love by
                  </p>
                  <p style="margin:0;font-family:${C.fontname};
                            font-size:16px;font-weight:700;color:${C.maroon};">
                    ${senderName}
                  </p>
                  <p style="margin:2px 0 0;font-family:${C.fontname};
                            font-size:12px;color:${C.roseGold};">
                    via Suhana Matrimony
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ════════════════
             FOOTER
             ════════════════ -->
        <tr>
          <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLight};
                     padding:18px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${C.textSecondary};
                      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
              This profile was shared with you by a Suhana Matrimony member. &nbsp;
              <a href="mailto:support@${domain}"
                 style="color:${C.maroon};text-decoration:none;font-weight:600;">
                Contact support</a>
              if you have any concerns.
            </p>
            <p style="margin:0;font-size:11px;color:${C.roseGoldLight};
                      font-family:Arial,Helvetica,sans-serif;">
              © ${year} Suhana Matrimony &nbsp;&bull;&nbsp; Connecting hearts, building futures.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
};