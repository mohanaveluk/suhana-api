import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelnyxWebhook } from 'telnyx/lib/webhooks';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { readSmsConfig } from './sms.config';
import { SmsDeliveryStatus, SmsMessage } from './entity/sms-message.entity';

/** Higher rank = further along. A status never moves backwards (webhooks can arrive out of order). */
const RANK: Record<SmsDeliveryStatus, number> = {
  [SmsDeliveryStatus.QUEUED]: 0,
  [SmsDeliveryStatus.ACCEPTED]: 1,
  [SmsDeliveryStatus.SENT]: 2,
  [SmsDeliveryStatus.UNKNOWN]: 3,
  [SmsDeliveryStatus.FAILED]: 4,
  [SmsDeliveryStatus.DELIVERED]: 4,
};

const FINAL_STATUS: Record<string, SmsDeliveryStatus> = {
  delivered: SmsDeliveryStatus.DELIVERED,
  delivery_failed: SmsDeliveryStatus.FAILED,
  sending_failed: SmsDeliveryStatus.FAILED,
  delivery_unconfirmed: SmsDeliveryStatus.UNKNOWN,
};

export type WebhookOutcome = 'updated' | 'duplicate' | 'ignored' | 'unknown-message';

/** Telnyx delivery-status webhooks: signature check (ed25519) + idempotent status update. */
@Injectable()
export class SmsWebhookService {
  private readonly verifier: TelnyxWebhook | null;

  constructor(
    @InjectRepository(SmsMessage) private readonly messages: Repository<SmsMessage>,
    private readonly logger: CustomLoggerService,
  ) {
    const key = readSmsConfig().publicKey;
    let verifier: TelnyxWebhook | null = null;
    if (key) {
      try {
        verifier = new TelnyxWebhook(key);
      } catch {
        this.logger.warn('TELNYX_PUBLIC_KEY is not a valid base64 ed25519 key — SMS webhooks will be rejected');
      }
    }
    this.verifier = verifier;
  }

  get canVerify(): boolean {
    return !!this.verifier;
  }

  /** Throws when the signature is missing/invalid/stale, or no public key is configured. */
  async verify(rawBody: string, headers: Record<string, string>): Promise<void> {
    if (!this.verifier) throw new Error('Webhook verification key not configured');
    await this.verifier.verify(rawBody, headers);
  }

  async handle(event: any): Promise<WebhookOutcome> {
    const data = event?.data;
    const eventId: string | undefined = data?.id;
    const type: string | undefined = data?.event_type;
    const messageId: string | undefined = data?.payload?.id;
    if (!eventId || !messageId || (type !== 'message.sent' && type !== 'message.finalized')) return 'ignored';

    const next = type === 'message.sent'
      ? SmsDeliveryStatus.SENT
      : FINAL_STATUS[data?.payload?.to?.[0]?.status] ?? SmsDeliveryStatus.UNKNOWN;
    const errorCode: string | null = data?.payload?.errors?.[0]?.code ? String(data.payload.errors[0].code).slice(0, 40) : null;

    const row = await this.messages.findOne({ where: { providerMessageId: messageId } });
    if (!row) return 'unknown-message';
    if (row.lastEventId === eventId) return 'duplicate';

    const advance = RANK[next] > RANK[row.status];
    await this.messages.update(row.id, {
      lastEventId: eventId,
      ...(advance ? { status: next } : {}),
      ...(advance && errorCode ? { errorCode } : {}),
    });
    if (advance && next === SmsDeliveryStatus.FAILED) {
      this.logger.warn(`SMS ${messageId} [${row.smsType}] to ${row.recipientMasked} failed delivery (${errorCode ?? 'no code'})`);
    }
    return advance ? 'updated' : 'duplicate';
  }
}
