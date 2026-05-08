import { AppConfigService } from '@/common/config/config.service';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

interface SendTextPayload {
  chatId: string;
  text: string;
  reply_to?: string;
  session?: string;
}

interface SendImagePayload {
  chatId: string;
  mimetype: string; // image/jpeg, image/png
  data: string; // URL atau base64
  filename?: string;
  caption?: string;
  reply_to?: string;
  session?: string;
  sendAs?: 'doc' | 'media';
}

@Injectable()
export class WaSenderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WaSenderService.name);

  constructor(private readonly config: AppConfigService) {}

  async onApplicationBootstrap() {
    this.logger.log('Menjadwalkan notifikasi startup server...');

    // Kita beri delay agar WAHA API sudah benar-benar siap dan login
    setTimeout(async () => {
      const isDev = this.config.isDevMode ? 'DEV' : 'PROD';

      const message =
        `*🚀 SERVER BERHASIL DIMULAI*\n\n` +
        `*Aplikasi:* ${this.config.appName} (${this.config.appVersion})\n` +
        `*Mode:* ${isDev}\n` +
        `*Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
        `*Node:* ${process.version}\n\n` +
        `_Sistem berhasil dijalankan (misal setelah restart atau update CI/CD) dan siap menerima pesan._`;

      if (this.config.adminLogGroupId) {
        try {
          await this.sendText({
            chatId: this.config.adminLogGroupId,
            text: message,
          });
          this.logger.log('Startup notification sent to Admin Log Group.');
        } catch (e) {
          this.logger.error(
            `Failed to send startup notification: ${e.message}`,
          );
        }
      } else if (
        this.config.adminNumbers &&
        this.config.adminNumbers.length > 0
      ) {
        // Kirim ke admin pertama saja agar tidak spam kalau admin banyak
        const firstAdmin = this.config.adminNumbers[0];
        try {
          await this.sendText({
            chatId: firstAdmin,
            text: message,
          });
          this.logger.log(`Startup notification sent to Admin: ${firstAdmin}`);
        } catch (e) {
          this.logger.error(
            `Failed to send startup notification: ${e.message}`,
          );
        }
      } else {
        this.logger.warn(
          'No Admin Numbers or Admin Log Group configured for startup notification.',
        );
      }
    }, 10000); // Delay 10 detik setelah NestJS ready
  }

  async sendText(payload: SendTextPayload): Promise<boolean> {
    let { chatId } = payload;

    // 0. Auto-append @c.us jika hanya angka (untuk kemudahan input di DB/Env)
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
      payload.chatId = chatId; // Update payload asli
    }

    // 1. Filter Dev Mode: Lebih fleksibel (bisa angka doang di env)
    if (this.config.isDevMode) {
      const isAdmin = this.config.adminNumbers.some((adminNum) =>
        chatId.includes(adminNum),
      );
      if (!isAdmin) {
        this.logger.warn(
          `[DEV MODE] Blokir pengiriman ke non-admin: ${chatId}`,
        );
        return false;
      }
    }

    // 2. Anti-Ban Delay + Typing Indicator
    await this.startTyping(chatId, payload.session);
    const delay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.stopTyping(chatId, payload.session);

    const url = `${this.config.wahaUrl}/api/sendText`;

    // Default session if not provided
    if (!payload.session) {
      payload.session = this.config.wahaSessionName;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.config.wahaApiKey) {
        headers['X-Api-Key'] = this.config.wahaApiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gagal mengirim WAHA API. Status: ${response.status}, Error: ${errorText}`,
        );
        return false;
      }

      this.logger.log(`Berhasil mengirim pesan ke ${payload.chatId}`);
      return true;
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Exception saat mengirim pesan via WAHA: ${errMessage}`,
      );
      return false;
    }
  }

  async startTyping(chatId: string, session?: string): Promise<boolean> {
    const url = `${this.config.wahaUrl}/api/startTyping`;
    return this.sendTypingRequest(url, chatId, session);
  }

  async stopTyping(chatId: string, session?: string): Promise<boolean> {
    const url = `${this.config.wahaUrl}/api/stopTyping`;
    return this.sendTypingRequest(url, chatId, session);
  }

  /**
   * Smart File Sender: Otomatis pilih endpoint berdasarkan mimetype
   */
  async sendFile(payload: SendImagePayload) {
    const { chatId, mimetype, sendAs } = payload;
    let endpoint = 'sendFile';

    // WAHA uses 'sendFile' to send as Document. If 'media' is requested, we pick endpoint based on mimetype.
    if (sendAs !== 'doc') {
      if (mimetype.startsWith('image/')) endpoint = 'sendImage';
      else if (mimetype.startsWith('video/')) endpoint = 'sendVideo';
      else if (mimetype.startsWith('audio/')) {
        endpoint = mimetype.includes('ogg') ? 'sendVoice' : 'sendFile';
      }
    }

    const url = `${this.config.wahaUrl}/api/${endpoint}`;

    // Typing Indicator
    await this.startTyping(chatId, payload.session);
    const delay = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.stopTyping(chatId, payload.session);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.config.wahaApiKey
            ? { 'X-Api-Key': this.config.wahaApiKey }
            : {}),
        },
        body: JSON.stringify({
          chatId,
          file: {
            url: payload.data,
            mimetype: payload.mimetype,
            filename: payload.filename,
          },
          ...(payload.caption ? { caption: payload.caption } : {}),
          ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
          session: payload.session || this.config.wahaSessionName,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Gagal mengirim ${endpoint}. Error: ${err}`);
      }
    } catch (error) {
      this.logger.error(`Error WAHA (${endpoint}): ${error.message}`);
    }
  }

  /**
   * Custom Link Preview Sender
   */
  async sendLinkPreview(payload: any) {
    const url = `${this.config.wahaUrl}/api/send/link-custom-preview`;
    const session = payload.session || this.config.wahaSessionName;

    await this.startTyping(payload.chatId, session);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.config.wahaApiKey
            ? { 'X-Api-Key': this.config.wahaApiKey }
            : {}),
        },
        body: JSON.stringify({
          ...payload,
          session,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Gagal mengirim Link Preview. Error: ${err}`);
      }
    } catch (error) {
      this.logger.error(`Error Link Preview: ${error.message}`);
    } finally {
      await this.stopTyping(payload.chatId, session);
    }
  }

  private async sendTypingRequest(
    url: string,
    chatId: string,
    session?: string,
  ): Promise<boolean> {
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.config.wahaApiKey) {
        headers['X-Api-Key'] = this.config.wahaApiKey;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId,
          session: session || this.config.wahaSessionName,
        }),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to send typing request to ${url}: ${error}`);
      return false;
    }
  }
}
