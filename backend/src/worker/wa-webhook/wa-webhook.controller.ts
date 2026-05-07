import { AppConfigService } from '@/common/config/config.service';
import { Public } from '@/common/decorators/public.decorator';
import type { RawBodyRequest } from '@nestjs/common';
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { WaCommandService } from '../wa-command/wa-command.service';

@ApiTags('Worker - WA Webhook')
@Controller('wa/webhook')
export class WaWebhookController {
  private readonly logger = new Logger(WaWebhookController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waCommandService: WaCommandService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Menerima webhook payload dari WAHA dengan HMAC' })
  @ApiConsumes('application/json')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') hubSignature256?: string,
    @Headers('x-waha-signature') wahaSignature?: string,
    @Headers('x-waha-webhook-token') token?: string,
  ) {
    const rawBody = req.rawBody;
    const hmacKey = this.config.wahaWebhookHmacKey;
    const payload = req.body;

    // 1. Validasi HMAC (Paling aman)
    if (hmacKey && rawBody) {
      const signature = crypto
        .createHmac('sha512', hmacKey)
        .update(rawBody)
        .digest('hex');

      const receivedSignature = (req.headers['x-webhook-hmac'] ||
        wahaSignature ||
        hubSignature256) as string;
      const isValidHmac =
        receivedSignature === signature ||
        receivedSignature === `sha256=${signature}`;

      if (!isValidHmac) {
        this.logger.warn(`Unauthorized Webhook: HMAC signature mismatch.`);
        throw new UnauthorizedException('Invalid HMAC signature');
      }
    }
    // 2. Fallback ke validasi Token Statis
    else if (token) {
      const secret = this.config.wahaWebhookToken;
      if (secret && token !== secret) {
        throw new UnauthorizedException('Token webhook tidak valid');
      }
    }

    this.logger.log(`Webhook Received [${payload?.event || 'Unknown'}]`);

    if (this.config.isDevMode) {
      this.logger.log(
        `[DEV MODE] Payload: ${JSON.stringify(payload, null, 2)}`,
      );
    }

    // Logic Bisnis: Handle Message Command
    if (payload?.event === 'message' || payload?.event === 'message.any') {
      const text = payload.payload?.body;
      const from = payload.payload?.from; // Group ID or Personal ID
      const participant = payload.payload?.participant; // Sender ID in group
      const messageId = payload.payload?.id;
      const hasMedia = payload.payload?.hasMedia;
      const mediaUrl = payload.payload?.media?.url;
      const session = payload.session;

      if (hasMedia) {
        this.waCommandService
          .processMedia(from, messageId, text, session, mediaUrl, participant, payload.payload)
          .catch((err) => {
            this.logger.error(`Error processing media upload: ${err}`);
          });
      } else {
        this.waCommandService
          .processMessage(from, text, messageId, session, participant, payload.payload)
          .catch((err) => {
            this.logger.error(`Error processing message command: ${err}`);
          });
      }
    }

    return { status: 'success' };
  }
}
