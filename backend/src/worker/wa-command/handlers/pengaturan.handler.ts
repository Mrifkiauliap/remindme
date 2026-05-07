import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class PengaturanHandler {
  private readonly logger = new Logger(PengaturanHandler.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  async handlePengaturanCommand(
    chatId: string,
    args: string[],
    isGroup: boolean,
    reply_to?: string,
  ) {
    const prefix = this.config.wahaCommandPrefix;
    if (!isGroup) {
      await this.waSender.sendText({
        chatId,
        text: '[ERROR] Pengaturan saat ini hanya tersedia untuk di dalam grup.',
        reply_to,
      });
      return;
    }

    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `*Cara Penggunaan Pengaturan:*\n\n1. *${prefix}setting reminder [on/off]*\n   Menyalakan/mematikan pengingat kuliah untuk grup ini.\n2. *${prefix}setting reminder [menit]*\n   Mengatur berapa menit sebelum kuliah pengingat dikirim (misal: 15, 30, 60).`,
        reply_to,
      });
      return;
    }

    const subCommand = args[0]?.toLowerCase();

    if (subCommand === 'reminder') {
      return this.handleReminderSetting(chatId, args.slice(1), reply_to);
    }

    await this.waSender.sendText({
      chatId,
      text: `[ERROR] Pengaturan *${subCommand}* tidak dikenali.`,
      reply_to,
    });
  }

  private async handleReminderSetting(
    chatId: string,
    args: string[],
    reply_to?: string,
  ) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Gunakan *${prefix}setting reminder on/off* atau *${prefix}setting reminder 15* (untuk 15 menit).`,
        reply_to,
      });
      return;
    }

    const value = args[0].toLowerCase();

    // Dapatkan grup ID
    const [grup] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.nomorWa, chatId))
      .limit(1);

    if (!grup) {
      await this.waSender.sendText({
        chatId,
        text: '[ERROR] Grup ini belum terdaftar di sistem. Gunakan perintah daftar terlebih dahulu.',
        reply_to,
      });
      return;
    }

    let key = '';
    let dbValue = '';
    let replyMsg = '';

    if (value === 'on' || value === 'off') {
      key = 'reminder_active';
      dbValue = value === 'on' ? 'true' : 'false';
      replyMsg = `[BERHASIL] Pengingat jadwal kuliah untuk grup ini telah *${value === 'on' ? 'Diaktifkan' : 'Dimatikan'}*.`;
    } else if (!isNaN(Number(value))) {
      const minutes = parseInt(value, 10);
      if (minutes < 5 || minutes > 120) {
        await this.waSender.sendText({
          chatId,
          text: '[ERROR] Waktu pengingat harus antara 5 sampai 120 menit.',
          reply_to,
        });
        return;
      }
      key = 'reminder_lead_time';
      dbValue = minutes.toString();
      replyMsg = `[BERHASIL] Waktu pengingat jadwal kuliah berhasil diubah menjadi *${minutes} menit* sebelum perkuliahan dimulai.`;
    } else {
      await this.waSender.sendText({
        chatId,
        text: '[ERROR] Nilai pengaturan tidak valid.',
        reply_to,
      });
      return;
    }

    // Update atau Insert setting
    const [existingSetting] = await this.drizzle.db
      .select()
      .from(schema.pengaturan)
      .where(
        and(
          eq(schema.pengaturan.grupId, grup.id),
          eq(schema.pengaturan.key, key),
        ),
      )
      .limit(1);

    if (existingSetting) {
      await this.drizzle.db
        .update(schema.pengaturan)
        .set({ value: dbValue, updatedAt: new Date() })
        .where(eq(schema.pengaturan.id, existingSetting.id));
    } else {
      await this.drizzle.db.insert(schema.pengaturan).values({
        grupId: grup.id,
        key,
        value: dbValue,
      });
    }

    await this.waSender.sendText({
      chatId,
      text: replyMsg,
      reply_to,
    });
  }
}
