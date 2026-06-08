// src/mail/templates/contact.email.templates.ts
// Suhana Matrimony — Contact Us email templates
//
// Exports:
//   contactThankYouTemplate(params)          → sent to the user
//   contactAdminNotificationTemplate(params) → sent to admin

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactTemplateParams {
  firstName:    string;
  lastName:     string;
  email:        string;
  mobile?:       string;
  subject:      string;
  message:      string;
  submittedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Security — escapeHtml()
//  All user-supplied strings MUST pass through this before being inserted into
//  HTML. Prevents XSS: e.g. <script>alert('x')</script> → &lt;script&gt;…
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: full HTML shell
// ─────────────────────────────────────────────────────────────────────────────

function shell(bodyContent: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Suhana Matrimony</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;background-color:#f2e5e5}
  @media only screen and (max-width:620px){
    .email-container{width:100%!important}
    .pad-mobile{padding:20px!important}
    .btn-block{display:block!important;margin-bottom:8px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f2e5e5;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
       style="background-color:#f2e5e5;padding:32px 16px;">
  <tr><td align="center">

    <table role="presentation" class="email-container" cellspacing="0" cellpadding="0"
           border="0" width="600"
           style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(183,110,121,0.18);">
      ${bodyContent}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
           style="max-width:600px;width:100%;margin-top:20px;">
      <tr>
        <td align="center"
            style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
                   color:#9b7578;line-height:1.8;padding:0 16px;">
          &copy; ${year} Suhana Matrimony. All rights reserved.<br>
          <span style="color:#b76e79;">Where hearts find their home.</span><br><br>
          This email was sent because a contact form was submitted on our website.
        </td>
      </tr>
    </table>

  </td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: header banner
// ─────────────────────────────────────────────────────────────────────────────

function headerBanner(subtitle: string): string {
  return `
<tr>
  <td style="background:#a20000;background:linear-gradient(135deg,#b76e79 0%,#a20000 100%);padding:0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="height:4px;background:linear-gradient(90deg,#c9a84c 0%,#e8d5a0 50%,#c9a84c 100%);"></td>
      </tr>
      <tr>
        <td align="center" style="padding:36px 32px 28px;">
          <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"
               style="display:block;margin:0 auto 14px;">
            <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
            <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(201,168,76,0.6)" stroke-width="1.5"/>
            <circle cx="32" cy="32" r="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
            <circle cx="32" cy="14" r="2" fill="rgba(201,168,76,0.8)"/>
            <circle cx="32" cy="50" r="2" fill="rgba(201,168,76,0.8)"/>
            <circle cx="14" cy="32" r="2" fill="rgba(201,168,76,0.8)"/>
            <circle cx="50" cy="32" r="2" fill="rgba(201,168,76,0.8)"/>
            <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="44" cy="20" r="1.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="20" cy="44" r="1.5" fill="rgba(255,255,255,0.5)"/>
            <circle cx="44" cy="44" r="1.5" fill="rgba(255,255,255,0.5)"/>
            <path d="M32 37 C32 37 22 30 22 24 C22 20.5 25 18 28 19 C29.5 19.5 31 21 32 22.5 C33 21 34.5 19.5 36 19 C39 18 42 20.5 42 24 C42 30 32 37 32 37Z"
                  fill="rgba(255,255,255,0.9)"/>
          </svg>

            <!-- Icon circle -->
            <div style="display:inline-block;
                        width:72px;height:72px;
                        background:rgba(255,255,255,0.18);
                        border-radius:20px;
                        text-align:center;line-height:72px;
                        margin-bottom:20px;">
            <!-- Support agent SVG (inline, no external dependency) -->
            <img src="https://img.icons8.com/ios-filled/48/ffffff/add-contact-to-company.png"
            alt="Mail icon" width="40" height="40"
                    style="display:block;border:0; padding: 16px;" >                
            </div>
                    
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;
                      color:#ffffff;letter-spacing:2px;margin-bottom:6px;">
            Suhana Matrimony
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
                      color:rgba(255,255,255,0.8);letter-spacing:1.5px;text-transform:uppercase;">
            ${subtitle}
          </div>
        </td>
      </tr>
      <tr>
        <td style="height:2px;background:linear-gradient(90deg,transparent 0%,#c9a84c 30%,#e8d5a0 50%,#c9a84c 70%,transparent 100%);"></td>
      </tr>
    </table>
  </td>
</tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared: card footer
// ─────────────────────────────────────────────────────────────────────────────

function cardFooter(): string {
  const year = new Date().getFullYear();
  return `
<tr>
  <td style="background:#a20000;background:linear-gradient(135deg,#b76e79 0%,#a20000 100%);
             padding:20px 32px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="font-family:Georgia,'Times New Roman',serif;font-size:13px;
                   color:rgba(255,255,255,0.85);font-style:italic;">
          Where hearts find their home.
        </td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;">
          <a href="mailto:contact@suhanamatrimony.com"
             style="color:#e8d5a0;text-decoration:none;">
            contact@suhanamatrimony.com
          </a>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top:14px;">
          <div style="height:1px;background:rgba(255,255,255,0.15);margin-bottom:10px;"></div>
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
                    color:rgba(255,255,255,0.55);text-align:center;margin:0;">
            &copy; ${year} Suhana Matrimony &nbsp;&bull;&nbsp;
            <a href="https://www.suhanamatrimony.com/privacy"
               style="color:rgba(255,255,255,0.55);text-decoration:underline;">Privacy Policy</a>
            &nbsp;&bull;&nbsp;
            <a href="https://www.suhanamatrimony.com"
               style="color:rgba(255,255,255,0.55);text-decoration:underline;">Visit Website</a>
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE 1 — contactThankYouTemplate  (sent to user)
// ─────────────────────────────────────────────────────────────────────────────

export function contactThankYouTemplate(params: ContactTemplateParams): string {
  const name     = escapeHtml(params.firstName);
  const email    = escapeHtml(params.email);
  const subject  = escapeHtml(params.subject);
  const message  = escapeHtml(params.message);
  const mobile   = escapeHtml(params.mobile || 'N/A');
  const rawMsg   = params.message.length > 280
    ? params.message.slice(0, 280) + '\u2026'
    : params.message;
  const msgSafe  = escapeHtml(rawMsg).replace(/\n/g, '<br>');

  const body = `
${headerBanner('Thank You for Reaching Out')}

<!-- ── White body ── -->
<tr>
  <td style="background-color:#fdf8f4;padding:40px 40px 32px;" class="pad-mobile">

    <!-- Personalised greeting -->
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
              font-weight:700;color:#3d2c2e;margin:0 0 8px;">
      Dear ${name},
    </p>
    <div style="width:48px;height:3px;
                background:linear-gradient(90deg,#b76e79,#c9a84c);
                border-radius:2px;margin-bottom:22px;"></div>

    <!-- Warm confirmation paragraph with 24-hour SLA -->
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3d2c2e;
              line-height:1.8;margin:0 0 16px;">
      Thank you for contacting
      <strong style="color:#a20000;">Suhana Matrimony</strong>.
      We are truly delighted that you chose to reach out to us, and we want you to know
      that your message is in safe hands.
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3d2c2e;
              line-height:1.8;margin:0 0 30px;">
      Our team will carefully review your enquiry and reach out to you within
      <strong style="color:#a20000;">24&nbsp;hours</strong>.
      We are committed to giving every message the warm, personal attention it deserves.
    </p>

    <!-- ── Your submission summary box ── -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fff0f2;border-radius:10px;overflow:hidden;
                  margin-bottom:28px;border:1px solid #f0d4d8;">
      <tr>
        <!-- Rose-gold left accent bar -->
        <td width="4"
            style="background:linear-gradient(180deg,#b76e79,#a20000);
                   border-radius:10px 0 0 10px;"></td>
        <td style="padding:20px 22px;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
                    color:#b76e79;margin:0 0 14px;">Your Submission</p>

          <!-- Subject row -->
          <table role="presentation" cellspacing="0" cellpadding="0"
                 border="0" width="100%" style="margin-bottom:14px;">
            <tr>
              <td width="70"
                  style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
                         font-weight:700;color:#6b5557;vertical-align:top;
                         padding-top:1px;">Message</td>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                         color:#3d2c2e;font-weight:600;">${message}</td>
            </tr>
          </table>

          <!-- Quoted message preview -->
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1px;
                    color:#6b5557;margin:0 0 8px;">Message received</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="4"
                  style="background-color:#b76e79;border-radius:2px;"></td>
              <td style="padding:10px 14px;">
                <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;
                          color:#6b5557;line-height:1.75;margin:0;font-style:italic;">
                  ${msgSafe}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ── "What happens next?" green checklist ── -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#f0faf5;border-radius:10px;overflow:hidden;
                  margin-bottom:28px;border:1px solid #c3e6d4;">
      <tr>
        <td style="padding:22px 24px;">
          <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
                    font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
                    color:#2d7a56;margin:0 0 16px;">What happens next?</p>

          <!-- Step 1 -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="margin-bottom:12px;">
            <tr>
              <td width="32" valign="top">
                <div style="width:28px;height:28px;border-radius:50%;
                            background:linear-gradient(135deg,#2d7a56,#3aa870);
                            text-align:center;line-height:28px;display:inline-block;
                            font-family:Arial,Helvetica,sans-serif;font-size:13px;
                            font-weight:700;color:#ffffff;">1</div>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                             color:#3d2c2e;line-height:1.65;">
                  <strong style="color:#2d7a56;">Our team reviews</strong>
                  your message and assigns it to the right specialist.
                </span>
              </td>
            </tr>
          </table>

          <!-- Step 2 -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                 style="margin-bottom:12px;">
            <tr>
              <td width="32" valign="top">
                <div style="width:28px;height:28px;border-radius:50%;
                            background:linear-gradient(135deg,#2d7a56,#3aa870);
                            text-align:center;line-height:28px;display:inline-block;
                            font-family:Arial,Helvetica,sans-serif;font-size:13px;
                            font-weight:700;color:#ffffff;">2</div>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                             color:#3d2c2e;line-height:1.65;">
                  We <strong style="color:#2d7a56;">reply to your email</strong>
                  at <strong>${email}</strong> within 24&nbsp;hours.
                </span>
              </td>
            </tr>
          </table>

          <!-- Step 3 -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="32" valign="top">
                <div style="width:28px;height:28px;border-radius:50%;
                            background:linear-gradient(135deg,#2d7a56,#3aa870);
                            text-align:center;line-height:28px;display:inline-block;
                            font-family:Arial,Helvetica,sans-serif;font-size:13px;
                            font-weight:700;color:#ffffff;">3</div>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                             color:#3d2c2e;line-height:1.65;">
                  <strong style="color:#2d7a56;">Urgent?</strong>
                  Call us at
                  <a href="tel:+919876543210"
                     style="color:#a20000;text-decoration:none;font-weight:700;">
                    +91&nbsp;98765&nbsp;43210
                  </a>
                  and we will prioritise your case immediately.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- ── Amber security note ── -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fffbec;border-radius:10px;overflow:hidden;
                  border:1px solid #e8d5a0;">
      <tr>
        <td width="4"
            style="background:linear-gradient(180deg,#c9a84c,#e8d5a0);
                   border-radius:10px 0 0 10px;"></td>
        <td style="padding:14px 18px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="28" valign="top" style="padding-top:1px;">
                <svg width="20" height="20" viewBox="0 0 24 24"
                     xmlns="http://www.w3.org/2000/svg" style="display:block;">
                  <path d="M12 2L1 21h22L12 2z" fill="#c9a84c" opacity="0.25"/>
                  <path d="M12 2L1 21h22L12 2z" fill="none" stroke="#c9a84c"
                        stroke-width="1.5" stroke-linejoin="round"/>
                  <line x1="12" y1="9" x2="12" y2="14" stroke="#c9a84c"
                        stroke-width="2" stroke-linecap="round"/>
                  <circle cx="12" cy="17.5" r="1" fill="#c9a84c"/>
                </svg>
              </td>
              <td style="padding-left:10px;">
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
                          color:#6b4f00;margin:0;line-height:1.65;">
                  <strong>Didn&apos;t submit this form?</strong>
                  Simply ignore this email &mdash; no action is required and
                  your information remains completely secure.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

  </td>
</tr>

<!-- Warm sign-off -->
<tr>
  <td style="background-color:#fff0f2;padding:24px 40px;
             border-top:1px solid #f0d4d8;">
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:15px;
              color:#3d2c2e;margin:0 0 4px;line-height:1.7;">
      With warm regards,
    </p>
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:17px;
              font-weight:700;color:#a20000;margin:0 0 3px;">
      The Suhana Matrimony Team
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
              color:#b76e79;margin:0;">
      Connecting hearts, building futures.
    </p>
  </td>
</tr>

${cardFooter()}`;

  return shell(body);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE 2 — contactAdminNotificationTemplate  (sent to admin)
// ─────────────────────────────────────────────────────────────────────────────

export function contactAdminNotificationTemplate(params: ContactTemplateParams): string {
  const firstName  = escapeHtml(params.firstName);
  const lastName   = escapeHtml(params.lastName);
  const fullName   = `${firstName} ${lastName}`;
  const email      = escapeHtml(params.email);
  const mobile      = params.mobile ? escapeHtml(params.mobile) : null;
  const subject    = escapeHtml(params.subject);
  const message    = escapeHtml(params.message).replace(/\n/g, '<br>');
  const ts         = params.submittedAt ?? new Date();
  const formatted  = ts.toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });

  // ── row() helper — keeps the structured data table DRY ──────────────────
  function row(label: string, value: string, isLast = false): string {
    const border = isLast ? '' : 'border-bottom:1px solid #f0d4d8;';
    return `
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
                 font-weight:700;color:#6b5557;padding:11px 0;
                 ${border}width:130px;vertical-align:top;">
        ${label}
      </td>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                 color:#3d2c2e;padding:11px 0 11px 16px;
                 ${border}vertical-align:top;">
        ${value}
      </td>
    </tr>`;
  }

  const callBtn = mobile
    ? `<td style="padding-left:10px;">
         <a href="tel:${mobile}"
            style="display:inline-block;background:#ffffff;color:#a20000;
                   font-family:Arial,Helvetica,sans-serif;font-size:13px;
                   font-weight:700;padding:10px 22px;border-radius:6px;
                   text-decoration:none;border:1.5px solid #b76e79;">
           &#128222;&nbsp; Call ${firstName}
         </a>
       </td>`
    : '';

  const body = `
${headerBanner('New Contact Form Submission')}

<!-- ── Alert strip ── -->
<tr>
  <td style="background:linear-gradient(90deg,#a20000,#b76e79);
             padding:12px 32px;text-align:center;">
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;
              font-weight:700;letter-spacing:1px;text-transform:uppercase;
              color:#ffffff;margin:0;">
      &#9679;&nbsp;&nbsp;Action Required &mdash; New Message Received&nbsp;&nbsp;&#9679;
    </p>
  </td>
</tr>

<!-- ── White body ── -->
<tr>
  <td style="background-color:#fdf8f4;padding:36px 40px 28px;" class="pad-mobile">

    <!-- Intro with full name + formatted timestamp -->
    <p style="font-family:Georgia,'Times New Roman',serif;font-size:20px;
              font-weight:700;color:#3d2c2e;margin:0 0 6px;">
      New enquiry from ${fullName}
    </p>
    <div style="width:48px;height:3px;
                background:linear-gradient(90deg,#b76e79,#c9a84c);
                border-radius:2px;margin-bottom:18px;"></div>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
              color:#6b5557;margin:0 0 22px;line-height:1.7;">
      A visitor has submitted the contact form on the Suhana Matrimony website.
      Full details are below. Please respond within
      <strong style="color:#a20000;">24&nbsp;hours</strong>.
    </p>

    <!-- Submission timestamp pill -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"
           style="margin-bottom:26px;">
      <tr>
        <td style="background-color:#fde8e8;border-radius:50px;
                   padding:7px 18px;border:1px solid #d4a0a7;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
                       color:#a20000;font-weight:600;">
            &#128337;&nbsp; Submitted: ${formatted} IST
          </span>
        </td>
      </tr>
    </table>

    <!-- ── Structured data table ── -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#ffffff;border-radius:10px;overflow:hidden;
                  border:1px solid #f0d4d8;margin-bottom:28px;">
      <!-- Table header row -->
      <tr>
        <td colspan="2"
            style="background:linear-gradient(135deg,#f0d4d8,#fde8e8);
                   padding:12px 20px;border-bottom:1px solid #e8c8cc;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
                       font-weight:700;text-transform:uppercase;letter-spacing:1.5px;
                       color:#b76e79;">Submission Details</span>
        </td>
      </tr>
      <!-- Data rows -->
      <tr>
        <td colspan="2" style="padding:0 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0"
                 border="0" width="100%">
            ${row('Full Name', fullName)}
            ${row('Email',
              `<a href="mailto:${email}"
                 style="color:#a20000;text-decoration:none;font-weight:600;">${email}</a>`)}
            ${row('Mobile',
              mobile
                ? `<a href="tel:${mobile}"
                     style="color:#a20000;text-decoration:none;font-weight:600;">${mobile}</a>`
                : '<span style="color:#b76e79;font-style:italic;">Not provided</span>')}
            ${row('Message', `<strong>${message}</strong>`)}
            ${row('Submitted at', formatted, true)}
          </table>
        </td>
      </tr>
    </table>

    <!-- ── Full message block ── -->
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;
              text-transform:uppercase;letter-spacing:1.5px;color:#6b5557;
              margin:0 0 10px;">Full Message</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#ffffff;border-radius:10px;overflow:hidden;
                  border:1px solid #f0d4d8;margin-bottom:28px;">
      <tr>
        <td width="4"
            style="background:linear-gradient(180deg,#b76e79,#a20000);
                   border-radius:10px 0 0 10px;"></td>
        <td style="padding:18px 20px;">
          <p style="font-family:Georgia,'Times New Roman',serif;font-size:14px;
                    color:#3d2c2e;line-height:1.85;margin:0;font-style:italic;">
            ${message}
          </p>
        </td>
      </tr>
    </table>

    <!-- ── 24-hour reminder strip ── -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color:#fffbec;border-radius:10px;overflow:hidden;
                  border:1px solid #e8d5a0;margin-bottom:10px;">
      <tr>
        <td width="4"
            style="background:linear-gradient(180deg,#c9a84c,#e8d5a0);
                   border-radius:10px 0 0 10px;"></td>
        <td style="padding:16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="28" valign="middle">
                <svg width="22" height="22" viewBox="0 0 24 24"
                     xmlns="http://www.w3.org/2000/svg" style="display:block;">
                  <circle cx="12" cy="12" r="10" fill="#c9a84c" opacity="0.2"/>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="#c9a84c" stroke-width="1.5"/>
                  <polyline points="12 6 12 12 16 14" fill="none" stroke="#c9a84c"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
              <td style="padding-left:12px;">
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;
                          color:#6b4f00;margin:0;line-height:1.6;">
                  <strong>Please respond to this enquiry within 24&nbsp;hours.</strong><br>
                  <span style="font-size:12px;color:#9b7022;">
                    Reply directly to
                    <a href="mailto:${email}"
                       style="color:#a20000;text-decoration:none;font-weight:600;">${email}</a>
                    or log your response in the CRM.
                  </span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

  </td>
</tr>

<!-- ── Quick action buttons ── -->
<tr>
  <td style="background-color:#fff0f2;padding:20px 40px;
             border-top:1px solid #f0d4d8;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td>
          <a href="mailto:${email}?subject=Re%3A%20${encodeURIComponent(params.subject)}"
             style="display:inline-block;
                    background:#a20000;
                    background:linear-gradient(135deg,#b76e79,#a20000);
                    color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;
                    font-weight:700;padding:11px 22px;border-radius:6px;
                    text-decoration:none;letter-spacing:0.3px;">
            &#9993;&nbsp; Reply to ${firstName}
          </a>
        </td>
        ${callBtn}
      </tr>
    </table>
  </td>
</tr>

${cardFooter()}`;

  return shell(body);
}