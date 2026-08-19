// ─────────────────────────────────────────────────────────────────────────────
//  SUHANA MATRIMONY — colour tokens
//  Mirrors the :root CSS variables used across the website so emails match the
//  brand exactly. Kept in sync with otc-email-templates.ts.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  roseGold:        '#b76e79',
  roseGoldLight:   '#d4a0a7',
  roseGoldLighter: '#f0d4d8',
  maroon:          '#a20000',
  maroonDark:      '#6e0000',
  ivoryWarm:       '#fdf8f4',
  gold:            '#c9a84c',
  goldLight:       '#e8d5a0',
  blush:           '#fde8e8',
  textPrimary:     '#3d2c2e',
  textSecondary:   '#6b5557',
  shadow:          'rgba(183, 110, 121, 0.15)',
  gradient:        'linear-gradient(135deg, #b76e79 0%, #a20000 100%)',
  green:           '#0f7b52',
  greenLight:      '#e6f6ee',
  fontname:        "'Segoe UI',Arial,sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Mobile number verified — confirmation (not an OTP carrier)
//
//  Sent once, after the member successfully submits the correct SMS code.
//  Doubles as a security notice: if the recipient did not do this, someone else
//  attached a number to their account and they need to tell support.
//
//  Design matches the existing Suhana templates:
//  ✓ Same outer shell (max-width 600px, radius 20px, brand shadow)
//  ✓ Same header (4px gold top strip · frosted icon box · gold badge)
//  ✓ Same info pills, same maroon/gold left-bar notes
//  ✓ Same sign-off + blush footer
// ─────────────────────────────────────────────────────────────────────────────
export const mobileVerifiedEmailTemplate = (params: {
  firstName?: string;
  mobileNumber: string;   // E.164, e.g. '+12105551234'
  domain: string;         // for the footer support link
  verifiedAt?: Date;
}): string => {
  const { mobileNumber, domain } = params;

  const year = new Date().getFullYear();
  const iconSrc = 'https://storage.googleapis.com/inv-images/home/fav-flrnd.png';

  const name = (params.firstName ?? '').trim();
  const username = !name || name.toLowerCase() === 'unknown' ? 'Member' : name;

  const verifiedOn = (params.verifiedAt ?? new Date()).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Mobile Number Verified – Aurora Matrimony</title>
</head>
<body style="margin:0;padding:0;background-color:${C.blush};font-family:${C.fontname}">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.blush};padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:20px;
                      box-shadow:0 8px 32px ${C.shadow};overflow:hidden;">

          <!-- ══════════════ HEADER ══════════════ -->
          <tr>
            <td style="background:${C.maroon};background:${C.gradient};padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td style="height:4px;
                             background:linear-gradient(90deg,
                               ${C.gold} 0%,${C.goldLight} 50%,${C.gold} 100%);">
                  </td>
                </tr>

                <tr>
                  <td style="padding:36px 40px 28px;text-align:center;">

                    <div style="display:inline-block;background:rgba(255,255,255,0.18);
                                border-radius:16px;padding:14px;margin-bottom:18px;">
                      <img src="${iconSrc}" alt="Verified"
                           width="40" height="40" style="display:block;border:0;" />
                    </div>

                    <h1 style="margin:0 0 8px;font-family:${C.fontname};
                               font-size:24px;font-weight:700;color:#ffffff;
                               letter-spacing:-0.3px;">
                      Mobile Number Verified
                    </h1>
                    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);
                              line-height:1.5;">
                      Your profile now carries a verified mobile badge
                    </p>

                    <div style="display:inline-block;background:rgba(201,168,76,0.22);
                                border:1px solid rgba(201,168,76,0.45);border-radius:50px;
                                padding:6px 18px;margin-top:16px;">
                      <span style="font-size:13px;font-weight:600;color:${C.goldLight};
                                   letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;">
                        &#10004;&nbsp; Verification Complete
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════════ BODY ══════════════ -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 8px;font-size:15px;color:${C.textPrimary};
                        line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                Hello <strong style="color:${C.textPrimary};">${username}</strong>,
              </p>
              <div style="width:40px;height:3px;background:${C.gradient};
                          border-radius:2px;margin:0 0 20px;"></div>

              <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;
                        font-size:15px;color:${C.textPrimary};line-height:1.8;">
                Your mobile number has been verified successfully.
                You can now continue using all features of
                <strong style="color:${C.maroon};">Aurora Matrimony</strong>
                with a verified profile.
              </p>

              <!-- ── Verified number block ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.greenLight};border:1px solid #b7e0cc;
                             border-radius:16px;padding:26px 20px;text-align:center;">

                    <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;
                              font-size:11px;font-weight:700;color:${C.green};
                              text-transform:uppercase;letter-spacing:1.8px;">
                      Verified Mobile Number
                    </p>

                    <p style="margin:0 0 10px;font-family:'Courier New',Courier,monospace;
                              font-size:26px;font-weight:800;color:${C.green};
                              letter-spacing:1px;">
                      ${mobileNumber}
                    </p>

                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:12px;color:${C.textSecondary};line-height:1.5;">
                      Verified on ${verifiedOn}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── Info pills ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:20px;">
                <tr>
                  <td width="50%" style="padding-right:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.goldLight};border-radius:10px;
                                 padding:14px 16px;text-align:center;">
                        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;
                                   font-size:10px;font-weight:700;color:${C.maroonDark};
                                   text-transform:uppercase;letter-spacing:0.7px;">
                          Trust signal
                        </p>
                        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                                   font-size:14px;color:${C.textPrimary};font-weight:600;">
                          Verified badge
                        </p>
                      </td>
                    </tr></table>
                  </td>
                  <td width="50%" style="padding-left:8px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="background:${C.roseGoldLighter};border-radius:10px;
                                 padding:14px 16px;text-align:center;">
                        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;
                                   font-size:10px;font-weight:700;color:${C.maroon};
                                   text-transform:uppercase;letter-spacing:0.7px;">
                          Visibility
                        </p>
                        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                                   font-size:14px;color:${C.textPrimary};font-weight:600;">
                          Higher match trust
                        </p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- ── Security note — amber left bar ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:20px;">
                <tr>
                  <td style="background:${C.goldLight};border-left:4px solid ${C.gold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;
                              font-size:13px;font-weight:700;color:${C.maroonDark};
                              line-height:1.4;">
                      Didn't verify this number?
                    </p>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:13px;color:${C.textSecondary};line-height:1.6;">
                      If you did not add or verify this mobile number, contact our support
                      team immediately — someone may have access to your account.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- ── Change note — maroon left bar ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:16px;">
                <tr>
                  <td style="background:${C.ivoryWarm};border-left:4px solid ${C.roseGold};
                             border-radius:6px;padding:14px 18px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                              font-size:13px;color:${C.textSecondary};line-height:1.6;">
                      <strong style="color:${C.maroon};">Changing your number later?</strong>
                      Updating your mobile number will clear this verified status, and you
                      will need to verify the new number once more.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ══════════════ SIGN-OFF ══════════════ -->
          <tr>
            <td style="background:${C.blush};border-top:1px solid ${C.roseGoldLighter};
                       padding:22px 40px;">
              <p style="margin:0 0 3px;font-family:${C.fontname};
                        font-size:15px;color:${C.textPrimary};">Thank you,</p>
              <p style="margin:0 0 2px;font-family:${C.fontname};
                        font-size:16px;font-weight:700;color:${C.maroon};">
                The Aurora Matrimony Team
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;
                        font-size:12px;color:${C.roseGold};">
                Connecting hearts, building futures.
              </p>
            </td>
          </tr>

          <!-- ══════════════ FOOTER ══════════════ -->
          <tr>
            <td style="background:${C.roseGoldLighter};border-top:1px solid ${C.roseGoldLight};
                       padding:18px 40px;text-align:center;">
              <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;color:${C.textSecondary};line-height:1.6;">
                This email was sent by
                <strong style="color:${C.maroon};">Aurora Matrimony</strong>
                because a mobile number was verified on your account.
                Questions? Contact our
                <a href="mailto:support@${domain}"
                   style="color:${C.maroon};text-decoration:none;font-weight:600;">
                  support team</a>.
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
