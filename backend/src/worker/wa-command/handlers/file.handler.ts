import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable } from '@nestjs/common';
import { eq, ilike } from 'drizzle-orm';
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
      case 'search':
      case 'cari':
        return this.handleSearchFile(chatId, subArgs, reply_to);
      case 'rename':
      case 'ganti':
        return this.handleRenameFile(chatId, subArgs, reply_to, participant);
      case 'info':
        return this.handleInfoFile(chatId, subArgs, reply_to);
      case 'stats':
        return this.handleStatsFile(chatId, reply_to, participant);
      case 'my':
      case 'me':
        return this.handleMyListFile(chatId, reply_to, participant);
      default:
        // Jika cuma .file [nama], asumsinya mau kirim file (send)
        if (
          args.length > 0 &&
          ![
            'list',
            'send',
            'delete',
            'setting',
            'share',
            'my',
            'me',
            'search',
            'rename',
            'info',
            'stats',
          ].includes(args[0])
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
    const dirPath = path.join(
      process.cwd(),
      'public',
      'uploads',
      'dosen',
      dosenFolder,
    );

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
      .map((f, i) => {
        const parts = f.split('.');
        const ext = parts.pop()?.toUpperCase() || 'BIN';
        const name = parts.join('.');
        return `${i + 1}. ${name} [${ext}]`;
      })
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

    const listText = myFiles
      .map((f, i) => {
        const ext = f.mimetype.split('/')[1]?.toUpperCase() || 'BIN';
        return `${i + 1}. ${f.nama} [${ext}]`;
      })
      .join('\n');

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

    const names = args
      .join(' ')
      .split(/[, ]+/)
      .filter((n) => n.length > 0);
    const results: string[] = [];

    for (const namaBerkas of names) {
      const [berkas] = await this.drizzle.db
        .select()
        .from(schema.berkas)
        .where(eq(schema.berkas.nama, namaBerkas))
        .limit(1);

      if (!berkas) {
        results.push(`- *${namaBerkas}*: [TIDAK DITEMUKAN]`);
        continue;
      }

      try {
        // 1. Hapus File Fisik
        const urlParts = berkas.url.split('/public/uploads/');
        if (urlParts.length > 1) {
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

        results.push(`- *${namaBerkas}*: [BERHASIL]`);
      } catch (error) {
        results.push(`- *${namaBerkas}*: [ERROR] (${error.message})`);
      }
    }

    await this.waSender.sendText({
      chatId,
      text: `*Hasil Penghapusan Berkas:*\n\n${results.join('\n')}`,
      reply_to,
    });
  }

  async handleSettingFile(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    if (args.length < 2) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah! Gunakan: *${prefix}file share [nama1, nama2, ...] [public/private]*`,
        reply_to,
      });
      return;
    }

    const visibility = args[args.length - 1].toLowerCase();
    if (!['public', 'private'].includes(visibility)) {
      await this.waSender.sendText({
        chatId,
        text: `Pilihan visibilitas tidak valid! Gunakan *public* atau *private* di akhir perintah.\n\nContoh: *${prefix}file share file1, file2 public*`,
        reply_to,
      });
      return;
    }

    const isPublic = visibility === 'public';
    const namesRaw = args.slice(0, -1).join(' ');
    const names = namesRaw.split(/[, ]+/).filter((n) => n.length > 0);
    const results: string[] = [];

    for (const name of names) {
      const [berkas] = await this.drizzle.db
        .select()
        .from(schema.berkas)
        .where(eq(schema.berkas.nama, name))
        .limit(1);

      if (!berkas) {
        results.push(`- *${name}*: [TIDAK DITEMUKAN]`);
        continue;
      }

      await this.drizzle.db
        .update(schema.berkas)
        .set({ isPublic, updatedAt: new Date() })
        .where(eq(schema.berkas.id, berkas.id));

      if (isPublic) {
        results.push(`- *${name}*: [OK]\n  Link: ${berkas.url}`);
      } else {
        results.push(`- *${name}*: [OK]`);
      }
    }

    await this.waSender.sendText({
      chatId,
      text: `*Hasil Update Status Akses (${visibility.toUpperCase()}):*\n\n${results.join('\n')}`,
      reply_to,
    });
  }

  async handleSearchFile(chatId: string, args: string[], reply_to?: string) {
    const query = args.join(' ').trim();
    if (!query) {
      await this.waSender.sendText({
        chatId,
        text: `Harap berikan kata kunci pencarian.`,
        reply_to,
      });
      return;
    }

    const results = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(ilike(schema.berkas.nama, `%${query}%`))
      .limit(15);

    if (results.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas dengan nama mengandung "${query}" tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    const listText = results
      .map((f, i) => {
        const ext = f.mimetype.split('/')[1]?.toUpperCase() || 'BIN';
        return `${i + 1}. ${f.nama} [${ext}]`;
      })
      .join('\n');

    await this.waSender.sendText({
      chatId,
      text: `*Hasil Pencarian "${query}":*\n\n${listText}`,
      reply_to,
    });
  }

  async handleInfoFile(chatId: string, args: string[], reply_to?: string) {
    const namaBerkas = args[0];
    if (!namaBerkas) {
      await this.waSender.sendText({
        chatId,
        text: `Harap berikan nama berkas.`,
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
        text: `Berkas *${namaBerkas}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    // Cek ukuran file fisik jika ada
    let sizeText = 'Unknown';
    try {
      const urlParts = berkas.url.split('/public/uploads/');
      if (urlParts.length > 1) {
        const relativePath = decodeURIComponent(urlParts[1]);
        const filePath = path.join(
          process.cwd(),
          'public',
          'uploads',
          relativePath,
        );
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          sizeText = (stats.size / 1024).toFixed(2) + ' KB';
          if (stats.size > 1024 * 1024) {
            sizeText = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
          }
        }
      }
    } catch (e) {}

    const info =
      `*Info Berkas:*\n` +
      `- Nama: ${berkas.nama}\n` +
      `- Tipe: ${berkas.mimetype}\n` +
      `- Ukuran: ${sizeText}\n` +
      `- Status: ${berkas.isPublic ? 'PUBLIK' : 'PRIVATE'}\n` +
      `- Pemilik: ${berkas.uploadedBy}\n` +
      `- Uploaded: ${berkas.createdAt.toLocaleString()}\n` +
      `- Keterangan: ${berkas.keterangan || '-'}` +
      (berkas.isPublic ? `\n- Link: ${berkas.url}` : '');

    await this.waSender.sendText({
      chatId,
      text: info,
      reply_to,
    });
  }

  async handleRenameFile(
    chatId: string,
    args: string[],
    reply_to?: string,
    participant?: string,
  ) {
    const oldName = args[0];
    const newName = args[1];

    if (!oldName || !newName) {
      await this.waSender.sendText({
        chatId,
        text: `Gunakan: .file rename [nama_lama] [nama_baru]`,
        reply_to,
      });
      return;
    }

    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, oldName))
      .limit(1);

    if (!berkas) {
      await this.waSender.sendText({
        chatId,
        text: `Berkas *${oldName}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    // Cek kepemilikan (Kecuali Admin)
    const isAdmin = this.config.adminNumbers.some((n) =>
      (participant || chatId).includes(n),
    );
    if (!isAdmin && berkas.uploadedBy !== (participant || chatId)) {
      await this.waSender.sendText({
        chatId,
        text: `Maaf, Anda hanya dapat merename berkas yang Anda upload sendiri.`,
        reply_to,
      });
      return;
    }

    // Cek apakah nama baru sudah dipakai
    const [existing] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, newName))
      .limit(1);

    if (existing) {
      await this.waSender.sendText({
        chatId,
        text: `Nama berkas *${newName}* sudah digunakan. Harap pilih nama lain.`,
        reply_to,
      });
      return;
    }

    try {
      const urlParts = berkas.url.split('/public/uploads/');
      if (urlParts.length > 1) {
        const relativePath = decodeURIComponent(urlParts[1]);
        const oldPath = path.join(
          process.cwd(),
          'public',
          'uploads',
          relativePath,
        );
        const folder = path.dirname(relativePath);
        const ext = path.extname(relativePath);
        const newRelativePath = path.join(folder, `${newName}${ext}`);
        const newPath = path.join(
          process.cwd(),
          'public',
          'uploads',
          newRelativePath,
        );

        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }

        // Update DB
        const newUrl = berkas.url.replace(
          encodeURIComponent(relativePath),
          encodeURIComponent(newRelativePath.replace(/\\/g, '/')),
        );

        await this.drizzle.db
          .update(schema.berkas)
          .set({ nama: newName, url: newUrl, updatedAt: new Date() })
          .where(eq(schema.berkas.id, berkas.id));

        await this.waSender.sendText({
          chatId,
          text: `[BERHASIL] Berkas berhasil diubah namanya menjadi *${newName}*.`,
          reply_to,
        });
      }
    } catch (e) {
      await this.waSender.sendText({
        chatId,
        text: `[ERROR] Gagal merename berkas: ${e.message}`,
        reply_to,
      });
    }
  }

  async handleStatsFile(
    chatId: string,
    reply_to?: string,
    participant?: string,
  ) {
    const isAdmin = this.config.adminNumbers.some((n) =>
      (participant || chatId).includes(n),
    );
    if (!isAdmin) {
      await this.waSender.sendText({
        chatId,
        text: `Maaf, perintah ini hanya untuk Admin.`,
        reply_to,
      });
      return;
    }

    const allFiles = await this.drizzle.db.select().from(schema.berkas);
    let totalSize = 0;
    let fileCount = allFiles.length;

    for (const berkas of allFiles) {
      try {
        const urlParts = berkas.url.split('/public/uploads/');
        if (urlParts.length > 1) {
          const relativePath = decodeURIComponent(urlParts[1]);
          const filePath = path.join(
            process.cwd(),
            'public',
            'uploads',
            relativePath,
          );
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
          }
        }
      } catch (e) {}
    }

    const sizeText = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';

    await this.waSender.sendText({
      chatId,
      text:
        `*Statistik Berkas Server:*\n\n` +
        `- Total Berkas: ${fileCount}\n` +
        `- Total Penggunaan Disk: ${sizeText}`,
      reply_to,
    });
  }
}
