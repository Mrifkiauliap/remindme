import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { WaSenderService } from '../wa-sender/wa-sender.service';

// Handlers
import { FileHandler } from './handlers/file.handler';
import { GroupHandler } from './handlers/group.handler';
import { MediaHandler } from './handlers/media.handler';
import { PengaturanHandler } from './handlers/pengaturan.handler';
import { ProfileHandler } from './handlers/profile.handler';
import { ScheduleHandler } from './handlers/schedule.handler';

@Injectable()
export class WaCommandService {
  private readonly logger = new Logger(WaCommandService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
    private readonly fileHandler: FileHandler,
    private readonly groupHandler: GroupHandler,
    private readonly scheduleHandler: ScheduleHandler,
    private readonly profileHandler: ProfileHandler,
    private readonly mediaHandler: MediaHandler,
    private readonly pengaturanHandler: PengaturanHandler,
  ) {}

  async processMessage(
    chatId: string,
    text: string,
    messageId?: string,
    session?: string,
    participant?: string,
    rawPayload?: any,
  ) {
    if (!text || !chatId) return;

    const prefix = this.config.wahaCommandPrefix;

    if (!text.toLowerCase().startsWith(prefix)) {
      return;
    }

    const args = text.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    const isGroup = chatId.includes('@g.us');
    const senderId = isGroup && participant ? participant : chatId;

    // Group Middleware
    if (isGroup) {
      const [grupExist] = await this.drizzle.db
        .select()
        .from(schema.grup)
        .where(eq(schema.grup.nomorWa, chatId))
        .limit(1);

      if (!grupExist && command !== 'daftar') {
        await this.waSender.sendText({
          chatId,
          text: `Grup ini belum terdaftar.\nSilakan daftarkan grup terlebih dahulu menggunakan perintah *${prefix}daftar [Nama Grup]*`,
          reply_to: messageId,
        });
        return;
      }
    }

    this.logger.log(
      `Menerima command: ${command} dari ${chatId} (sender: ${senderId})`,
    );

    const reply_to = messageId;

    try {
      switch (command) {
        case 'ping': {
          const isAdmin = this.config.adminNumbers.some((n) =>
            senderId.includes(n),
          );
          if (!isAdmin) {
            await this.waSender.sendText({
              chatId,
              text: 'Pong!',
              reply_to,
            });
            break;
          }

          const uptime = process.uptime();
          const days = Math.floor(uptime / (24 * 3600));
          const hours = Math.floor((uptime % (24 * 3600)) / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          const memoryUsage = process.memoryUsage();
          const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2);
          const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
          const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

          const textPing =
            `*PONG!*\n\n` +
            `*Server Info:*\n` +
            `- App: ${this.config.appName} (${this.config.appVersion})\n` +
            `- Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
            `- OS: ${process.platform} ${process.arch}\n` +
            `- Memory: RSS ${rss}MB | Heap ${heapUsed}/${heapTotal}MB\n` +
            `- Node: ${process.version}\n` +
            `- Mode: ${this.config.isDevMode ? 'DEV' : 'PROD'}\n\n` +
            `*Config Info:*\n` +
            `- WA Session: ${this.config.wahaSessionName}\n` +
            `- Prefix: ${this.config.wahaCommandPrefix}\n` +
            `- Webhook URL: ${this.config.wahaUrl}\n` +
            `- Port: ${this.config.port}`;

          await this.waSender.sendText({
            chatId,
            text: textPing,
            reply_to,
          });
          break;
        }
        case 'daftar':
          const handledGroup = await this.groupHandler.handleDaftar(
            chatId,
            senderId,
            isGroup,
            args,
            reply_to,
          );
          if (!handledGroup) {
            await this.profileHandler.handleDaftar(chatId, args, reply_to);
          }
          break;
        case 'jadwal':
          await this.scheduleHandler.handleJadwal(
            chatId,
            args,
            isGroup,
            reply_to,
          );
          break;
        case 'dosen':
          await this.scheduleHandler.handleDosen(chatId, args, reply_to);
          break;
        case 'me':
          await this.profileHandler.handleMe(chatId, args, reply_to);
          break;
        case 'file':
          const quotedForFile = this.getQuotedMessageInfo(rawPayload);
          if (args[0]?.toLowerCase() === 'save' && quotedForFile?.id) {
            await this.mediaHandler.processMedia(
              chatId,
              quotedForFile.id,
              args.slice(1).join(' '),
              session || 'default',
              quotedForFile.mediaUrl,
              participant,
            );
            break;
          }

          await this.fileHandler.handleFileCommand(
            chatId,
            args,
            reply_to,
            rawPayload,
            session,
            participant,
          );
          break;
        case 'me-grup':
          if (isGroup) await this.groupHandler.handleMeGrup(chatId, reply_to);
          else
            await this.waSender.sendText({
              chatId,
              text: 'Perintah ini hanya bisa digunakan di dalam grup.',
              reply_to,
            });
          break;
        case 'grup-jadwal':
          if (isGroup)
            await this.groupHandler.handleGrupJadwal(
              chatId,
              senderId,
              args,
              reply_to,
            );
          else
            await this.waSender.sendText({
              chatId,
              text: 'Perintah ini hanya bisa digunakan di dalam grup.',
              reply_to,
            });
          break;
        case 'setting':
        case 'pengaturan':
          await this.pengaturanHandler.handlePengaturanCommand(
            chatId,
            args,
            isGroup,
            reply_to,
          );
          break;

        case 'save':
        case 'simpan':
          const quotedInfo = this.getQuotedMessageInfo(rawPayload);
          if (quotedInfo?.id) {
            await this.mediaHandler.processMedia(
              chatId,
              quotedInfo.id,
              text,
              session || 'default',
              quotedInfo.mediaUrl,
              participant,
            );
          } else {
            this.logger.debug(
              `Quoted message ID not found in /save. Payload: ${JSON.stringify(rawPayload)}`,
            );
            await this.waSender.sendText({
              chatId,
              text: `Harap reply sebuah pesan file/media dengan perintah ini.`,
              reply_to,
            });
          }
          break;
        case 'scan':
          await this.waSender.sendFile({
            chatId,
            session: this.config.wahaSessionName,
            data: `${this.config.wahaUrl}api/${this.config.wahaSessionName}/auth/qr`,
            mimetype: 'image/png',
            filename: 'qr.png',
          });
          break;
        case 'dev': {
          const isAdmin = this.config.adminNumbers.some((n) =>
            senderId.includes(n),
          );
          if (!isAdmin) {
            await this.waSender.sendText({
              chatId,
              text: 'Maaf, perintah ini hanya untuk Admin.',
              reply_to,
            });
            break;
          }

          const action = args[0]?.toLowerCase();
          if (action === 'on') {
            this.config.setRuntimeDevMode(true);
            await this.waSender.sendText({
              chatId,
              text: '*DEV_MODE diaktifkan.* Bot hanya akan mengirim pesan ke Admin.',
              reply_to,
            });
          } else if (action === 'off') {
            this.config.setRuntimeDevMode(false);
            await this.waSender.sendText({
              chatId,
              text: '*DEV_MODE dimatikan.* Bot dalam mode produksi (kirim ke semua user).',
              reply_to,
            });
          } else if (action === 'reset') {
            this.config.setRuntimeDevMode(null);
            await this.waSender.sendText({
              chatId,
              text: `*DEV_MODE direset* ke setelan awal .env (${this.config.isDevMode ? 'ON' : 'OFF'}).`,
              reply_to,
            });
          } else {
            await this.waSender.sendText({
              chatId,
              text: `Gunakan: *${prefix}dev on/off/reset*\nStatus saat ini: *${this.config.isDevMode ? 'ON' : 'OFF'}*`,
              reply_to,
            });
          }
          break;
        }
        default:
          await this.waSender.sendText({
            chatId,
            text: `Command *${prefix}${command}* tidak dikenali.\n\nCommand tersedia:\n${prefix}daftar\n${prefix}jadwal\n${prefix}dosen\n${prefix}me\n${prefix}file`,
          });
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing command ${command}:`, error);

      // Notif ke User
      await this.waSender.sendText({
        chatId,
        text: `[ERROR] Terjadi kesalahan saat memproses perintah *${prefix}${command}*. Silakan coba lagi nanti atau hubungi admin.`,
        reply_to,
      });

      // Notif ke Admin
      const errorMsg =
        `*🚨 BOT ERROR NOTIFICATION*\n\n` +
        `*Command:* ${command}\n` +
        `*Chat ID:* ${chatId}\n` +
        `*Sender:* ${senderId}\n` +
        `*Error:* ${error.message || error}\n\n` +
        `*Stack:* \`\`\`${error.stack?.substring(0, 500) || '-'}\`\`\``;

      if (this.config.adminLogGroupId) {
        // Kirim ke grup log admin (lebih efisien)
        await this.waSender.sendText({
          chatId: this.config.adminLogGroupId,
          text: errorMsg,
        });
      } else {
        // Fallback japri satu-satu ke semua admin
        for (const adminNum of this.config.adminNumbers) {
          await this.waSender.sendText({
            chatId: adminNum,
            text: errorMsg,
          });
        }
      }
    }
  }

  private getQuotedMessageInfo(
    payload: any,
  ): { id?: string; mediaUrl?: string } | undefined {
    const id =
      payload?.replyTo?.id ||
      payload?.quotedMsgId ||
      payload?._data?.quotedMsg?.id?._serialized ||
      payload?._data?.quotedStanzaID ||
      payload?._data?.quotedMsg?.id ||
      payload?.quotedMsg?.id ||
      payload?._data?.msg?.contextInfo?.stanzaId;

    if (!id) return undefined;

    return {
      id,
      mediaUrl:
        payload?.replyTo?.media?.url || payload?._data?.quotedMsg?.media?.url,
    };
  }

  async processMedia(
    chatId: string,
    messageId: string,
    caption: string,
    session: string,
    mediaUrl?: string,
    participant?: string,
    rawPayload?: any,
  ) {
    return this.mediaHandler.processMedia(
      chatId,
      messageId,
      caption,
      session,
      mediaUrl,
      participant,
    );
  }
}
