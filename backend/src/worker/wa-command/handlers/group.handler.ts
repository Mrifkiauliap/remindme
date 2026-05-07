import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class GroupHandler {
  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  async handleDaftar(
    chatId: string,
    senderId: string,
    isGroup: boolean,
    args: string[],
    reply_to?: string,
  ): Promise<boolean> {
    if (!isGroup) {
      return false; // Not handled here, pass to profile handler
    }

    // Logic Pendaftaran Grup
    // 1. Cek otorisasi pendaftar
    const isAdmin = this.config.adminNumbers.some((n) => senderId.includes(n));
    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      const [mhs] = await this.drizzle.db
        .select()
        .from(schema.mahasiswa)
        .where(eq(schema.mahasiswa.nomorWa, senderId))
        .limit(1);
      const [dsn] = await this.drizzle.db
        .select()
        .from(schema.dosen)
        .where(eq(schema.dosen.nomorWa, senderId))
        .limit(1);
      if (mhs || dsn) isAuthorized = true;
    }

    if (!isAuthorized) {
      await this.waSender.sendText({
        chatId,
        text: `Maaf, Anda tidak memiliki izin untuk mendaftarkan grup ini. Hanya user terdaftar yang bisa mendaftarkan grup.`,
        reply_to,
      });
      return true;
    }

    const prefix = this.config.wahaCommandPrefix;
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah! Gunakan perintah: *${prefix}daftar [Nama Grup]*\nContoh: ${prefix}daftar Kelas_TI_Pagi`,
        reply_to,
      });
      return true;
    }

    // Gabungkan args menjadi nama grup
    const rawNamaGrup = args.join('_');

    // Cek apakah grup dengan ID WA ini sudah terdaftar
    const [existingId] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.nomorWa, chatId))
      .limit(1);
    if (existingId) {
      await this.waSender.sendText({
        chatId,
        text: `Grup ini sudah terdaftar dengan nama *${existingId.namaGrup}*.`,
        reply_to,
      });
      return true;
    }

    // Pastikan nama grup unik
    let finalNamaGrup = rawNamaGrup;
    const [existingName] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.namaGrup, finalNamaGrup))
      .limit(1);
    if (existingName) {
      finalNamaGrup = `${rawNamaGrup}_${Math.floor(Math.random() * 1000)}`;
    }

    const uid = Math.random().toString(36).substring(2, 10);

    // Insert ke DB
    await this.drizzle.db.insert(schema.grup).values({
      uid,
      namaGrup: finalNamaGrup,
      nomorWa: chatId,
      keterangan: `Didaftarkan oleh ${senderId}`,
    });

    await this.waSender.sendText({
      chatId,
      text: `✅ *Berhasil!*\nGrup ini telah terdaftar di sistem dengan nama: *${finalNamaGrup}*\nUID: ${uid}\n\nSekarang Anda dapat menggunakan perintah bot di grup ini.`,
      reply_to,
    });
    return true;
  }

  async handleMeGrup(chatId: string, reply_to?: string) {
    const [grup] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.nomorWa, chatId))
      .limit(1);

    if (!grup) {
      await this.waSender.sendText({
        chatId,
        text: `Grup ini belum terdaftar.`,
        reply_to,
      });
      return;
    }

    await this.waSender.sendText({
      chatId,
      text: `*Info Grup*\n\nNama: ${grup.namaGrup}\nUID: ${grup.uid}\nID WA: ${grup.nomorWa}\nKeterangan: ${grup.keterangan || '-'}`,
      reply_to,
    });
  }
}
