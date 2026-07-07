export function shareProfileEmailTemplate1(params: {
  senderName: string;
  receiverName: string;
  profileUrl: string;
  subject?: string;
  body?: string;
  domain: string;
}): string {
  const defaultSubject = `${params.senderName} thinks you might like this profile on Suhana Matrimony`;
  const personalMessage = params.body
    ? `<div style="background:#f5f3ff;border-left:4px solid #8B5CF6;padding:16px;border-radius:4px;margin:20px 0;">
        <p style="margin:0;color:#555;font-size:14px;font-style:italic;">"${params.body}"</p>
      </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>${defaultSubject}</title></head>
    <body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;margin:0;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <div style="background:#8B5CF6;padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">💜 Someone Wants to Share a Profile With You</h1>
        </div>

        <div style="padding:28px;">
          <p style="color:#444;font-size:15px;">Dear ${params.receiverName},</p>
          <p style="color:#444;font-size:15px;">
            <strong>${params.senderName}</strong> found a profile on <strong>Suhana Matrimony</strong> and thought you might be interested.
          </p>

          ${personalMessage}

          <div style="text-align:center;margin:28px 0;">
            <a href="${params.profileUrl}"
               style="background:#8B5CF6;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
              View Profile
            </a>
          </div>

          <p style="color:#888;font-size:13px;text-align:center;">
            Or copy this link into your browser:<br>
            <a href="${params.profileUrl}" style="color:#8B5CF6;word-break:break-all;">${params.profileUrl}</a>
          </p>

          <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
          <p style="color:#444;font-size:15px;">Warm regards,<br><strong>The Suhana Matrimony Team</strong></p>
        </div>

        <div style="background:#f3f4f6;padding:16px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            © Suhana Matrimony &nbsp;·&nbsp;
            <a href="${params.domain}" style="color:#9ca3af;">${params.domain}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
