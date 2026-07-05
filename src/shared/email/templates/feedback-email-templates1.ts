// ── Admin notification ────────────────────────────────────────────────────────

export function feedbackAdminNotificationTemplate1(params: {
  adminName?: string;
  userName: string;
  category: string;
  rating?: number;
  subject: string;
  message: string;
  feedbackId: string;
  isAnonymous: boolean;
}): string {
  const displayName = params.isAnonymous ? 'Anonymous User' : params.userName;
  const ratingStars = params.rating
    ? '★'.repeat(params.rating) + '☆'.repeat(5 - params.rating)
    : 'Not rated';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>New Feedback — Suhana Matrimony</title></head>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #8B5CF6; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">📋 New Feedback Received</h1>
        </div>
        <div style="padding: 28px;">
          <p style="color: #444; font-size: 15px;">Hello ${params.adminName ?? 'Admin'},</p>
          <p style="color: #444; font-size: 15px;">A new feedback has been submitted on <strong>Suhana Matrimony</strong>.</p>

          <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <tr style="background: #f3f4f6;">
              <td style="padding: 10px 14px; font-weight: bold; color: #555; width: 35%;">Submitted By</td>
              <td style="padding: 10px 14px; color: #333;">${displayName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: bold; color: #555;">Category</td>
              <td style="padding: 10px 14px; color: #333;">${params.category.replace(/_/g, ' ')}</td>
            </tr>
            <tr style="background: #f3f4f6;">
              <td style="padding: 10px 14px; font-weight: bold; color: #555;">Rating</td>
              <td style="padding: 10px 14px; color: #f59e0b;">${ratingStars}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: bold; color: #555;">Subject</td>
              <td style="padding: 10px 14px; color: #333;">${params.subject}</td>
            </tr>
            <tr style="background: #f3f4f6;">
              <td style="padding: 10px 14px; font-weight: bold; color: #555; vertical-align: top;">Message</td>
              <td style="padding: 10px 14px; color: #333;">${params.message}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: bold; color: #555;">Feedback ID</td>
              <td style="padding: 10px 14px; color: #6b7280; font-size: 12px;">${params.feedbackId}</td>
            </tr>
          </table>

          <p style="color: #888; font-size: 13px;">Please log in to the admin panel to review and take action on this feedback.</p>
        </div>
        <div style="background: #f3f4f6; padding: 16px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© Suhana Matrimony · This is an automated notification</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Thank-you to submitter ────────────────────────────────────────────────────

export function feedbackThankYouTemplate1(params: {
  userName: string;
  subject: string;
  category: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Thank You — Suhana Matrimony</title></head>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #8B5CF6; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">💜 Thank You For Your Feedback</h1>
        </div>
        <div style="padding: 28px;">
          <p style="color: #444; font-size: 15px;">Dear ${params.userName},</p>
          <p style="color: #444; font-size: 15px;">
            Thank you for taking the time to share your feedback with us. Your voice helps us build a better
            experience for everyone on <strong>Suhana Matrimony</strong>.
          </p>
          <div style="background: #f5f3ff; border-left: 4px solid #8B5CF6; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #555; font-size: 14px;"><strong>Subject:</strong> ${params.subject}</p>
            <p style="margin: 8px 0 0; color: #555; font-size: 14px;"><strong>Category:</strong> ${params.category.replace(/_/g, ' ')}</p>
          </div>
          <p style="color: #444; font-size: 15px;">
            We have received your feedback and our team will review it shortly. If your feedback requires a
            response, we will get back to you as soon as possible.
          </p>
          <p style="color: #444; font-size: 15px;">Warm regards,<br><strong>The Suhana Matrimony Team</strong></p>
        </div>
        <div style="background: #f3f4f6; padding: 16px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© Suhana Matrimony · You received this because you submitted feedback</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Profile feedback notification to target ───────────────────────────────────

export function profileFeedbackNotificationTemplate1(params: {
  targetName: string;
  reviewerName: string;
  isAnonymous: boolean;
  category: string;
  subject: string;
  loginUrl?: string;
}): string {
  const reviewerDisplay = params.isAnonymous ? 'a Suhana member' : params.reviewerName;
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>New Profile Feedback — Suhana Matrimony</title></head>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #8B5CF6; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">⭐ New Feedback On Your Profile</h1>
        </div>
        <div style="padding: 28px;">
          <p style="color: #444; font-size: 15px;">Dear ${params.targetName},</p>
          <p style="color: #444; font-size: 15px;">
            You have received new feedback from <strong>${reviewerDisplay}</strong> on your Suhana Matrimony profile.
          </p>
          <div style="background: #f5f3ff; border-left: 4px solid #8B5CF6; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #555; font-size: 14px;"><strong>Type:</strong> ${params.category.replace(/_/g, ' ')}</p>
            <p style="margin: 8px 0 0; color: #555; font-size: 14px;"><strong>Subject:</strong> ${params.subject}</p>
          </div>
          <p style="color: #444; font-size: 15px;">
            Feedback is reviewed by our moderation team before it appears on your profile. Once approved,
            it will be visible to other members if marked as public.
          </p>
          ${params.loginUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${params.loginUrl}" style="background: #8B5CF6; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">View My Profile</a>
          </div>` : ''}
          <p style="color: #444; font-size: 15px;">Warm regards,<br><strong>The Suhana Matrimony Team</strong></p>
        </div>
        <div style="background: #f3f4f6; padding: 16px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© Suhana Matrimony</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Reply notification to original submitter ──────────────────────────────────

export function feedbackReplyTemplate1(params: {
  userName: string;
  originalSubject: string;
  replyMessage: string;
  repliedBy: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Response To Your Feedback — Suhana Matrimony</title></head>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #8B5CF6; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">💬 Response To Your Feedback</h1>
        </div>
        <div style="padding: 28px;">
          <p style="color: #444; font-size: 15px;">Dear ${params.userName},</p>
          <p style="color: #444; font-size: 15px;">
            We have reviewed your feedback and ${params.repliedBy} has sent you a response.
          </p>

          <div style="background: #f5f3ff; border-radius: 6px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 6px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Feedback</p>
            <p style="margin: 0; color: #555; font-size: 14px; font-style: italic;">"${params.originalSubject}"</p>
          </div>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0 0 6px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Our Response</p>
            <p style="margin: 0; color: #333; font-size: 15px;">${params.replyMessage}</p>
          </div>

          <p style="color: #444; font-size: 15px;">
            Thank you for helping us improve Suhana Matrimony. Your feedback is invaluable to us.
          </p>
          <p style="color: #444; font-size: 15px;">Warm regards,<br><strong>${params.repliedBy}</strong><br>Suhana Matrimony Team</p>
        </div>
        <div style="background: #f3f4f6; padding: 16px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© Suhana Matrimony · Response to your submitted feedback</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
