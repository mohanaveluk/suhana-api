import { Injectable, Optional } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { EmailHistoryService } from 'src/modules/email-history/email-history.service';

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  // Optional history metadata — when provided the send is automatically logged
  history?: {
    emailType: string;
    fromUserId?: string;
    toUserId?: string;
    metadata?: Record<string, any>;
    createdBy?: string;
  };
}

@Injectable()
export class EmailService {
  private transporter;

  constructor(
    // @Optional() lets EmailService work even when EmailHistoryModule is not imported
    @Optional() private readonly emailHistoryService: EmailHistoryService,
  ) {
    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, cc, subject, html, history } = options;
    let success = false;
    let info: any = null;
    let errorMessage: string | null = null;

    try {
      info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        cc,
        subject,
        html,
      });
      success = true;
    } catch (error: any) {
      errorMessage = error.message;
      console.error('Email sending failed:', error);
    }

    // Auto-log to email_history if metadata was provided — failure here must never block the caller
    if (history && this.emailHistoryService) {
      try {
        await this.emailHistoryService.saveEmailHistory({
          emailType:  history.emailType,
          fromUserId: history.fromUserId,
          toUserId:   history.toUserId,
          from:       process.env.SMTP_FROM,
          to,
          cc,
          subject,
          html,
          status:     success ? 'SENT' : 'FAILED',
          createdBy:  history.createdBy,
          providerMessageId: info.messageId,
          metadata: {
            ...history.metadata,
            accepted: info?.accepted,
            rejected: info?.rejected,
            response: info?.response,
            envelope: info?.envelope,
            messageSize: info?.messageSize,
            errorMessage,
          },
        });
      } catch (historyError) {
        console.error('Failed to save email history:', historyError);
      }
    }

    return success;
  }
}
