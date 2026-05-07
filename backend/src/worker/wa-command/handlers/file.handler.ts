import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class FileHandler {
  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * Router untuk command .file
   */
  async handleFileCommand(
    chatId: string,
    args: string[],
    reply_to?: string,
    rawPayload?: any,
    session?: string,
    participant?: string,
  ) {
    const subCommand = args[0]?.toLowerCase();
    const subArgs = args.slice(1);

    switch (subCommand) {
      case 'list':
        return this.handleListFile(chatId, subArgs, reply_to);
      case 'save':
        return this.handleSaveFile(chatId, subArgs, reply_to);
      case 'send':
        return this.handleSendFile(chatId, subArgs, reply_to);
      case 'delete':
        return this.handleDeleteFile(chatId, subArgs, reply_to);
      case 'setting':
      case 'share':
        return this.handleSettingFile(chatId, subArgs, reply_to);
      case 'my':
      case 'me':
        return this.handleMyListFile(chatId, reply_to, participant);
      default:
        // Jika cuma .file [nama], asumsinya mau kirim file (send)
        if (
          args.length > 0 &&
          !['list', 'send', 'delete', 'setting', 'share', 'my', 'me'].includes(
            args[0],
          )
        ) {
          return this.handleSendFile(chatId, args, reply_to);
        }
        return this.handleListFile(chatId, args, reply_to);
    }
  }

  async handleListFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Untuk melihat file berikan nama dosen.\nContoh: *${prefix}file list Budi*`,
        reply_to,
      });
      return;
    }

    const dosenQuery = args.join(' ').toLowerCase();

    // Cari dosen
    const dosens = await this.drizzle.db.select().from(schema.dosen);
    const matchedDosen = dosens.find((d) =>
      d.nama.toLowerCase().includes(dosenQuery),
    );

    if (!matchedDosen) {
      await this.waSender.sendText({
        chatId,
        text: `Dosen dengan nama yang mengandung "${dosenQuery}" tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    const dosenFolder = matchedDosen.nama.replace(/[^a-zA-Z0-9]/g, '_');
    const dirPath = path.join(process.cwd(), 'public', 'uploads', dosenFolder);

    if (!fs.existsSync(dirPath)) {
      await this.waSender.sendText({
        chatId,
        text: `Belum ada berkas yang tersimpan untuk dosen *${matchedDosen.nama}*.`,
        reply_to,
      });
      return;
    }

    const files = fs.readdirSync(dirPath);
    if (files.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Belum ada berkas yang tersimpan untuk dosen *${matchedDosen.nama}*.`,
        reply_to,
      });
      return;
    }

    const listText = files
      .map((f, i) => `${i + 1}. ${f.split('.')[0]}`)
      .join('\n');
    await this.waSender.sendText({
      chatId,
      text: `*Daftar Berkas Dosen ${matchedDosen.nama}:*\n\n${listText}\n\nGunakan *${prefix}file send [nama] doc/media* untuk mengambil berkas.`,
      reply_to,
    });
  }

  async handleMyListFile(
    chatId: string,
    reply_to?: string,
    participant?: string,
  ) {
    const prefix = this.config.wahaCommandPrefix;
    const uploaderId = participant || chatId;

    const myFiles = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.uploadedBy, uploaderId));

    if (myFiles.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Belum ada berkas yang Anda simpan.`,
        reply_to,
      });
      return;
    }

    const listText = myFiles.map((f, i) => `${i + 1}. ${f.nama}`).join('\n');

    await this.waSender.sendText({
      chatId,
      text: `*Daftar Berkas Anda:*\n\n${listText}\n\nGunakan *${prefix}file send [nama] doc/media* untuk mengambil berkas.`,
      reply_to,
    });
  }

  async handleSendFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length < 2) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah atau tidak lengkap!\n\nPastikan nanya dulu mau dikirim dokumen atau file media?\nGunakan:\n*${prefix}file send [nama_berkas] doc* (Kirim sebagai dokumen)\n*${prefix}file send [nama_berkas] media* (Kirim sebagai media/gambar)`,
        reply_to,
      });
      return;
    }

    const namaBerkas = args[0];
    const sendAs = args[1]?.toLowerCase();

    if (!['doc', 'media'].includes(sendAs)) {
      await this.waSender.sendText({
        chatId,
        text: `Pilihan tidak valid! Gunakan *doc* atau *media*.\nContoh: *${prefix}file send ${namaBerkas} doc*`,
        reply_to,
      });
      return;
    }

    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, namaBerkas))
      .limit(1);

    if (!berkas) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas dengan nama *${namaBerkas}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    await this.waSender.sendFile({
      chatId,
      mimetype: berkas.mimetype,
      data: berkas.url,
      filename: `${berkas.nama}.${berkas.mimetype.split('/')[1] || 'bin'}`,
      reply_to,
      sendAs: sendAs as 'doc' | 'media',
    });
  }

  async handleSaveFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah! Gunakan: *${prefix}file save [nama_berkas]*`,
        reply_to,
      });
      return;
    }

    const namaBerkas = args[0];
    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, namaBerkas))
      .limit(1);

    if (berkas) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas dengan nama *${namaBerkas}* sudah ada.`,
        reply_to,
      });
      return;
    }

    await this.waSender.sendText({
      chatId,
      text: `Format salah! Gunakan: *${prefix}file save [nama_berkas]*`,
      reply_to,
    });
  }

  async handleDeleteFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah! Gunakan: *${prefix}file delete [nama_berkas]*`,
        reply_to,
      });
      return;
    }

    const namaBerkas = args[0];
    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, namaBerkas))
      .limit(1);

    if (!berkas) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas dengan nama *${namaBerkas}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    try {
      // 1. Hapus File Fisik
      const urlParts = berkas.url.split('/public/uploads/');
      if (urlParts.length > 1) {
        // Decode URI component agar string %20 dll kembali menjadi spasi jika ada
        const relativePath = decodeURIComponent(urlParts[1]);
        const filePath = path.join(
          process.cwd(),
          'public',
          'uploads',
          relativePath,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // 2. Hapus dari Database
      await this.drizzle.db
        .delete(schema.berkas)
        .where(eq(schema.berkas.id, berkas.id));

      await this.waSender.sendText({
        chatId,
        text: `✅ Berkas *${namaBerkas}* berhasil dihapus dari sistem.`,
        reply_to,
      });
    } catch (error) {
      this.waSender.sendText({
        chatId,
        text: `❌ Gagal menghapus berkas: ${error.message}`,
        reply_to,
      });
    }
  }

  async handleSettingFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length < 2) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah! Gunakan: *${prefix}file setting [nama_berkas] [public/private]*`,
        reply_to,
      });
      return;
    }

    const namaBerkas = args[0];
    const visibility = args[1]?.toLowerCase();

    if (!['public', 'private'].includes(visibility)) {
      await this.waSender.sendText({
        chatId,
        text: `Pilihan tidak valid! Gunakan *public* atau *private*.`,
        reply_to,
      });
      return;
    }

    const isPublic = visibility === 'public';

    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, namaBerkas))
      .limit(1);

    if (!berkas) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas dengan nama *${namaBerkas}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    await this.drizzle.db
      .update(schema.berkas)
      .set({ isPublic, updatedAt: new Date() })
      .where(eq(schema.berkas.id, berkas.id));

    await this.waSender.sendText({
      chatId,
      text: `✅ Status akses berkas *${namaBerkas}* berhasil diubah menjadi *${visibility.toUpperCase()}*.\n\n${
        isPublic
          ? `Link publik dapat diakses di: ${berkas.url}`
          : 'Link file sekarang disembunyikan.'
      }`,
      reply_to,
    });
  }
}
