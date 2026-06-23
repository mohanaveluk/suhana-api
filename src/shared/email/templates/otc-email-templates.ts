import { readFileSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  SUHANA MATRIMONY — colour tokens
//  Mirrors the :root CSS variables used across the website so emails match
//  the brand exactly. Update here once if the palette ever changes.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  roseLight:       '#fcf1f1',
  roseGold:        '#b76e79',  // --suhana-rose-gold
  roseGoldLight:   '#d4a0a7',  // --suhana-rose-gold-light
  roseGoldLighter: '#f0d4d8',  // --suhana-rose-gold-lighter
  maroon:          '#a20000',  // --suhana-maroon
  maroonDark:      '#6e0000',  // --suhana-maroon-dark
  ivory:           '#fffff0',  // --suhana-ivory
  ivoryWarm:       '#fdf8f4',  // --suhana-ivory-warm
  gold:            '#c9a84c',  // --suhana-gold
  goldLight:       '#e8d5a0',  // --suhana-gold-light
  blush:           '#fde8e8',  // --suhana-blush
  bblush:          '#ecc8c8',  // --suhana-blush
  textPrimary:     '#3d2c2e',  // --suhana-text-primary
  textSecondary:   '#6b5557',  // --suhana-text-secondary
  shadow:          'rgba(183, 110, 121, 0.15)',          // --suhana-shadow
  gradient:        'linear-gradient(135deg, #b76e79 0%, #a20000 100%)',        // --suhana-gradient
  gradientLight1:  'linear-gradient(135deg, #f0d4d8 0%, #fde8e8 100%)',        // --suhana-gradient-light1
  gradientLight:   'linear-gradient(135deg, #fff0f2 0%, #f2e5e5 100%)',        // --suhana-gradient-light
};

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helper — reads an SVG from assets and returns a Base64 data URI
//  so images are fully self-contained (no external requests, works in Outlook)
// ─────────────────────────────────────────────────────────────────────────────
function getSvgIconBase64(filename: string, fallbackPath: string): string {
  try {
    const svgPath = join(__dirname, '..', '..', '..', 'assets', 'images', filename);
    return `data:image/svg+xml;base64,${readFileSync(svgPath).toString('base64')}`;
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(fallbackPath).toString('base64')}`;
  }
}

function getMailIconBase64(): string {
  return getSvgIconBase64(
    'mail-verify.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="white">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`,
  );
}

function getVoteIconBase64(): string {
  return getSvgIconBase64(
    'vote-otp.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="white">
      <path d="M18 3H6C4.9 3 4 3.9 4 5v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V7h9v2z"/>
    </svg>`,
  );
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

// ─────────────────────────────────────────────────────────────────────────────
//  Template 2 — Suhana Matrimony verification OTP
//  Sent when a user submits a Suhana Matrimony; contains a large 6-digit code to enter
//  in the verification dialog — NOT a clickable link.
// ─────────────────────────────────────────────────────────────────────────────
export const voteOtpEmailTemplate = (params: {
  otp:        string;   // 6-digit code  e.g. '503868'
  suhanaName: string;   // name of the suhana being voted on
  partyName:  string;   // party the user selected
  voterEmail: string;   // recipient address (shown back to user for clarity)
  domain:     string;   // for footer support link
  expiresInMinutes?: number; // default 5
}): string => {

  const {
    otp,
    suhanaName,
    partyName,
    voterEmail,
    domain,
    expiresInMinutes = 5,
  } = params;

  const year         = new Date().getFullYear();
  const voteIconSrc  = "https://img.icons8.com/ios-filled/50/ffffff/one-time-password.png"; //getVoteIconBase64();

  // Render each OTP digit as an individual styled cell for maximum email-client
  // compatibility (avoids letter-spacing / word-spacing rendering differences)
  const otpCells = otp
    .split('')
    .map(
      (digit) =>
        `<td style="width:52px;height:60px;background:#eef2ff;border:2px solid #c7d2fe;
                    border-radius:12px;text-align:center;vertical-align:middle;
                    font-size:28px;font-weight:800;color:#4f46e5;
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
  <title>Your vote verification code – Voter-Pulse</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ff;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f5f3ff;padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px rgba(79,70,229,0.12);overflow:hidden;">

          <!-- ── Header — indigo/amber palette to distinguish from account email ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
                       padding:40px 40px 32px;text-align:center;">

              <div style="display:inline-block;background:rgba(255,255,255,0.18);
                          border-radius:16px;padding:14px;margin-bottom:18px;">
                <img src="${voteIconSrc}" alt="Vote icon"
                     width="40" height="40" style="display:block;border:0;" />
              </div>

              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;
                         letter-spacing:-0.3px;">Your Vote Verification Code</h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
                Use the code below to confirm your vote
              </p>

              <!-- Amber suhana name badge -->
              <div style="display:inline-block;background:rgba(245,158,11,0.2);
                          border:1px solid rgba(245,158,11,0.4);border-radius:50px;
                          padding:6px 18px;margin-top:16px;">
                <span style="font-size:13px;font-weight:600;color:#fde68a;
                             letter-spacing:0.3px;">
                  ${suhanaName}
                </span>
              </div>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">
                Hi <strong style="color:#1e1b4b;">${voterEmail}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.7;">
                We received your vote for
                <strong style="color:#4f46e5;">${partyName}</strong>
                in the <strong>${suhanaName}</strong> suhana.
                Enter the 6-digit code below in the verification window to confirm your vote.
              </p>

              <!-- ── OTP block ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f5f3ff;border:1px solid #ddd6fe;
                             border-radius:16px;padding:28px 20px;text-align:center;">

                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;
                               color:#7c3aed;text-transform:uppercase;letter-spacing:1.5px;">
                      Verification Code
                    </p>

                    <!-- Individual digit cells -->
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="margin:0 auto 16px;">
                      <tr>${otpCells}</tr>
                    </table>

                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                      Enter this code in the verification dialog on the suhana page
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
                      <td style="background:#fff8e1;border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:#d97706;text-transform:uppercase;letter-spacing:0.7px;">
                          Expires in
                        </p>
                        <p style="margin:0;font-size:14px;color:#555;font-weight:600;">
                          ${expiresInMinutes} minutes
                        </p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:#ecfdf5;border-radius:10px;padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;
                                   color:#059669;text-transform:uppercase;letter-spacing:0.7px;">
                          Your selection
                        </p>
                        <p style="margin:0;font-size:14px;color:#555;font-weight:600;
                                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          ${partyName}
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
                  <td style="background:#fef9f0;border-left:4px solid #f59e0b;
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#92400e;
                               font-weight:700;line-height:1.4;">
                      Didn't request this code?
                    </p>
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
                      If you did not attempt to cast a vote, please ignore this email.
                      Your vote will <strong>not</strong> be recorded unless the code is entered.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── One-vote reminder ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:16px;">
                <tr>
                  <td style="background:#f0f2f8;border-left:4px solid #4f46e5;
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
                      <strong style="color:#4f46e5;">One vote per suhana.</strong>
                      Once verified, your vote is final and cannot be changed.
                      Each participant may vote only once per suhana.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#f7f8ff;border-top:1px solid #e5e7eb;
                       padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#888;line-height:1.6;">
                This email was sent by <strong style="color:#4f46e5;">Voter-Pulse</strong>
                on behalf of the suhana organiser.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:#4f46e5;text-decoration:none;font-weight:600;">support team</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#bbb;">
                © ${year} Voter-Pulse. All rights reserved.
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

export const buildOtpEmailHtml1 = (otp: string, firstName: string): string => {
    const year = new Date().getFullYear();

    const otpCells = otp
      .split('')
      .map(
        (d) => `
          <td style="width:52px;height:64px;
                    background:${C.roseLight};border:2px solid ${C.bblush};
                    border-radius:12px;text-align:center;vertical-align:middle;
                    font-size:30px;font-weight:800;color:${C.maroonDark};
                    font-family:'Courier New',Courier,monospace;">
            ${d}
          </td>`,
      )
      .join('<td style="width:8px;"></td>');

    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>Password Reset Code – Suhana Matrimony</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f3ff;
              font-family:'Segoe UI',Arial,sans-serif;">
  
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#f5f3ff;padding:40px 16px;">
      <tr><td align="center">
  
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="max-width:560px;background:#fff;border-radius:20px;
                      box-shadow:0 8px 32px rgba(79,70,229,0.12);overflow:hidden;">
  
          <!-- Header -->
          <tr>
            <td style="background:${C.maroon};background:${C.gradient};
                      padding:40px 40px 32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;
                        color:#fff;letter-spacing:-0.3px;">
                Password Reset Code
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
                Enter this code to reset your password
              </p>
            </td>
          </tr>
  
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">
                Hi <strong>${firstName}</strong>,<br/><br/>
                We received a request to reset the password for your Suhana Matrimony account.
                Use the code below — it is valid for <strong>5 minutes</strong>.
              </p>
  
              <!-- OTP block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.blush};border:1px solid ${C.roseGoldLighter};
                            border-radius:16px;padding:28px 20px;text-align:center;">
                    <p style="margin:0 0 18px;font-size:11px;font-weight:700;
                              color:${C.roseGold};text-transform:uppercase;letter-spacing:1.8px;">
                      Verification Code
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0"
                          style="margin:0 auto 16px;">
                      <tr>${otpCells}</tr>
                    </table>
                    <p style="margin:0;font-size:12px;color:${C.roseGold};">
                      Enter this code exactly as shown
                    </p>
                  </td>
                </tr>
              </table>
  
              <!-- Info pills -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="margin-top:20px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:#fff8e1;border-radius:10px;padding:12px 14px;text-align:center;">
                        <p style="margin:0 0 3px;font-size:10px;font-weight:700;
                                  color:#d97706;text-transform:uppercase;letter-spacing:0.7px;">
                          Expires in
                        </p>
                        <p style="margin:0;font-size:14px;color:#555;font-weight:600;">5 minutes</p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:#fce4ec;border-radius:10px;padding:12px 14px;text-align:center;">
                        <p style="margin:0 0 3px;font-size:10px;font-weight:700;
                                  color:#be185d;text-transform:uppercase;letter-spacing:0.7px;">
                          Single use
                        </p>
                        <p style="margin:0;font-size:14px;color:#555;font-weight:600;">One-time code</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
  
              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="margin-top:20px;">
                <tr>
                  <td style="background:#fef9f0;border-left:4px solid #f59e0b;
                            border-radius:6px;padding:14px 18px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;">
                      Didn't request this?
                    </p>
                    <p style="margin:0;font-size:13px;color:#666;line-height:1.6;">
                      Ignore this email — your password will not change unless you enter this code.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
  
          <!-- Footer -->
          <tr>
            <td style="background:#f7f8ff;border-top:1px solid #e5e7eb;
                      padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#888;">
                Sent by <strong style="color:#4f46e5;">Suhana Matrimony</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#bbb;">
                © ${year} Suhana Matrimony. All rights reserved.
              </p>
            </td>
          </tr>
  
        </table>
      </td></tr>
    </table>
  </body>
  </html>`.trim();
}

export const buildOtpEmailHtml = (otp: string, firstName: string): string => {
    const year = new Date().getFullYear();
    const heartIconSrc  = "https://storage.googleapis.com/inv-images/home/fav-flrnd.png"; //getHeartIconBase64();
    const username = firstName?.toLocaleLowerCase() === "unknown" ? "User": firstName;

    const otpCells = otp
      .split('')
      .map(
        (d) => `
          <td style="width:52px;height:64px;
                    background:#f0d4d8;border:2px solid #d4a0a7;
                    border-radius:12px;text-align:center;vertical-align:middle;
                    font-size:30px;font-weight:800;color:#a20000;
                    font-family:'Courier New',Courier,monospace;">
            ${d}
          </td>`,
      )
      .join('<td style="width:8px;"></td>');

    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>Password Reset Code – Suhana Matrimony</title>
  </head>
  <body style="margin:0;padding:0;background:#fde8e8;
              font-family:'Segoe UI',Arial,sans-serif;">
  
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#fde8e8;padding:40px 16px;">
      <tr><td align="center">
  
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="max-width:560px;background:#fff;border-radius:20px;
                      box-shadow:0 8px 32px rgba(183,110,121,0.15);overflow:hidden;">
  
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#b76e79 0%,#a20000 100%);
                      padding:40px 40px 32px;text-align:center;">

              <div style="display:inline-block;background:rgba(255,255,255,0.5);
                          border-radius:50px;padding:3px;margin-bottom:18px;">
                <img src="${heartIconSrc}" alt="Verification icon"
                     width="60" height="60" style="display:block;border:0;" />
              </div>

              <h1 style="margin:0 0 8px;font-family:'Segoe UI',Arial,sans-serif;
                        font-size:24px;font-weight:700;
                        color:#fff;letter-spacing:-0.3px;">
                Password Reset Code
              </h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;">
                Enter this code to reset your password
              </p>
            </td>
          </tr>
  
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 24px;font-size:15px;color:#3d2c2e;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                Dear <strong>${username}</strong>,<br/><br/>
                We received a request to reset the password for your <strong style="color:#a20000;">Suhana Matrimony</strong> account.
                Use the code below — it is valid for <strong>5 minutes</strong>.
              </p>
  
              <!-- OTP block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#fde8e8;border:1px solid #d4a0a7;
                            border-radius:16px;padding:28px 20px;text-align:center;">
                    <p style="margin:0 0 18px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;
                              color:#a20000;text-transform:uppercase;letter-spacing:1.8px;">
                      Verification Code
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0"
                          style="margin:0 auto 16px;">
                      <tr>${otpCells}</tr>
                    </table>
                    <p style="margin:0;font-size:12px;color:#6b5557;font-family:Arial,Helvetica,sans-serif;">
                      Enter this code exactly as shown
                    </p>
                  </td>
                </tr>
              </table>
  
              <!-- Info pills -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="margin-top:20px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:#e8d5a0;border-radius:10px;padding:12px 14px;text-align:center;">
                        <p style="margin:0 0 3px;font-size:10px;font-weight:700;font-family:Arial,Helvetica,sans-serif;
                                  color:#6e0000;text-transform:uppercase;letter-spacing:0.7px;">
                          Expires in
                        </p>
                        <p style="margin:0;font-size:14px;color:#3d2c2e;font-weight:600;font-family:Arial,Helvetica,sans-serif;">5 minutes</p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:#f0d4d8;border-radius:10px;padding:12px 14px;text-align:center;">
                        <p style="margin:0 0 3px;font-size:10px;font-weight:700;font-family:Arial,Helvetica,sans-serif;
                                  color:#a20000;text-transform:uppercase;letter-spacing:0.7px;">
                          Single use
                        </p>
                        <p style="margin:0;font-size:14px;color:#3d2c2e;font-weight:600;font-family:Arial,Helvetica,sans-serif;">One-time code</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
  
              <!-- Security note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="margin-top:20px;">
                <tr>
                  <td style="background:#fdf8f4;border-left:4px solid #c9a84c;
                            border-radius:6px;padding:14px 18px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#6e0000;font-family:Arial,Helvetica,sans-serif;">
                      Didn't request this?
                    </p>
                    <p style="margin:0;font-size:13px;color:#6b5557;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                      Ignore this email — your password will not change unless you enter this code.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
  
          <!-- Footer -->
          <tr>
            <td style="background:#fde8e8;border-top:1px solid #f0d4d8;
                      padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#6b5557;font-family:Arial,Helvetica,sans-serif;">
                Sent by <strong style="color:#a20000;">Suhana Matrimony</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#d4a0a7;font-family:Arial,Helvetica,sans-serif;">
                © ${year} Suhana Matrimony. All rights reserved.
              </p>
            </td>
          </tr>
  
        </table>
      </td></tr>
    </table>
  </body>
  </html>`.trim();
}