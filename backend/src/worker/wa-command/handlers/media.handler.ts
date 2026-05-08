import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class MediaHandler {
  private readonly logger = new Logger(MediaHandler.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  async processMedia(
    chatId: string,
    messageId: string,
    caption: string,
    session: string,
    mediaUrl?: string,
    participant?: string,
  ) {
    const isGroup = chatId.includes('@g.us');
    const senderId = isGroup && participant ? participant : chatId;

    // Group Middleware
    if (isGroup) {
      const [grupExist] = await this.drizzle.db
        .select()
        .from(schema.grup)
        .where(eq(schema.grup.nomorWa, chatId))
        .limit(1);

      if (!grupExist) {
        // Jika media dikirim ke grup yang belum terdaftar, abaikan
        return;
      }
    }

    // 1. Check Authorization (Gunakan senderId)
    const isAdminEnv = this.config.adminNumbers.some((num) =>
      senderId.includes(num),
    );
    let isAuthorized = isAdminEnv;
    let senderType: 'admin' | 'dosen' | 'mahasiswa' | 'unknown' = isAdminEnv
      ? 'admin'
      : 'unknown';
    let dosenData: any = null;

    if (!isAuthorized) {
      const [dosenFound] = await this.drizzle.db
        .select()
        .from(schema.dosen)
        .where(eq(schema.dosen.nomorWa, senderId))
        .limit(1);
      if (dosenFound) {
        isAuthorized = true;
        senderType = 'dosen';
        dosenData = dosenFound;
      }
    }
    if (!isAuthorized) {
      const [mhsFound] = await this.drizzle.db
        .select()
        .from(schema.mahasiswa)
        .where(eq(schema.mahasiswa.nomorWa, senderId))
        .limit(1);
      if (mhsFound) {
        isAuthorized = true;
        senderType = 'mahasiswa';
      }
    }

    if (!isAuthorized) {
      this.logger.warn(
        `Media rejected from unauthorized sender: ${senderId} in chat ${chatId}`,
      );
      return;
    }

    // Cek apakah caption mengandung kata "simpan" atau "save"
    const hasSaveCommand = /\b(simpan|save)\b/i.test(caption || '');

    // Logika penyimpanan:
    // Dosen: Otomatis simpan (tidak perlu perintah)
    // Mahasiswa & Admin: Harus pakai perintah "simpan" atau "save"
    if (senderType === 'mahasiswa' || senderType === 'admin') {
      if (!hasSaveCommand) {
        return;
      }
    }

    this.logger.log(`Downloading media for ${messageId} from ${chatId}`);

    // 2. Download Media dari WAHA
    const url =
      mediaUrl ||
      `${this.config.wahaUrl}/api/messages/${messageId}/download?session=${session}`;
    const response = await fetch(url, {
      headers: {
        Accept: '*/*',
        ...(this.config.wahaApiKey
          ? { 'X-Api-Key': this.config.wahaApiKey }
          : {}),
      },
    });

    if (!response.ok) {
      this.logger.error(`Failed to download media: ${response.statusText}`);
      return;
    }

    // 2.5 Validasi Ukuran File Maksimal (20MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeInMB = parseInt(contentLength, 10) / (1024 * 1024);
      if (sizeInMB > 20) {
        await this.waSender.sendText({
          chatId,
          text: '[ERROR] Gagal menyimpan! Ukuran file melebihi batas maksimal 20MB.',
          reply_to: messageId,
        });
        return;
      }
    }

    // 3. Simpan File Lokal
    const mimetype =
      response.headers.get('content-type') || 'application/octet-stream';
    let extension = mimetype.split('/')[1] || 'bin';
    if (extension.includes(';')) extension = extension.split(';')[0];

    const prefix = this.config.wahaCommandPrefix;
    let cleanCaption = caption || '';
    const commandRegex = new RegExp(`^\\${prefix}(save|simpan)\\s*`, 'i');
    cleanCaption = cleanCaption.replace(commandRegex, '');
    cleanCaption = cleanCaption.replace(/\b(simpan|save)\b/gi, '').trim();
    cleanCaption = cleanCaption
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    // 4. Hapus underscore yang berjejer atau ada di awal/akhir
    cleanCaption = cleanCaption.replace(/^_+|_+$/g, '').replace(/_{2,}/g, '_');

    // Gunakan caption yang sudah dibersihkan, atau default ke timestamp jika kosong
    let namaBerkas = cleanCaption || `file_${Date.now()}`;

    // Selalu tambahkan suffix timestamp singkat untuk memastikan keunikan (sesuai request)
    namaBerkas = `${namaBerkas}_${Math.floor(Date.now() / 1000)
      .toString()
      .slice(-5)}`;

    // Pastikan nama file unik di DB
    const existing = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, namaBerkas))
      .limit(1);
    if (existing.length > 0) {
      namaBerkas = `${namaBerkas}_${Date.now()}`;
    }

    const filename = `${namaBerkas}.${extension}`;

    // Buat folder berjenjang sesuai tipe pengirim
    const subFolderParts: string[] = [];
    if (senderType === 'admin') {
      subFolderParts.push('admin', senderId.split('@')[0]);
    } else if (senderType === 'dosen' && dosenData) {
      subFolderParts.push(
        'dosen',
        dosenData.nama.replace(/[^a-zA-Z0-9]/g, '_'),
      );
    } else if (senderType === 'mahasiswa') {
      // Cari data mahasiswa untuk ambil namanya jika ada
      const [mhsData] = await this.drizzle.db
        .select()
        .from(schema.mahasiswa)
        .where(eq(schema.mahasiswa.nomorWa, senderId))
        .limit(1);

      if (mhsData) {
        subFolderParts.push(
          'mahasiswa',
          mhsData.nama.replace(/[^a-zA-Z0-9]/g, '_'),
        );
      } else {
        subFolderParts.push('mahasiswa', senderId.split('@')[0]);
      }
    } else {
      subFolderParts.push('others', senderId.split('@')[0]);
    }

    const subFolderPath = path.join(...subFolderParts);
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      subFolderPath,
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    const fileStream = fs.createWriteStream(filepath);

    // @ts-ignore
    await pipeline(response.body, fileStream);

    // 4. Simpan Info ke DB
    // Encode subfolder parts agar URL aman dan join dengan slash
    const urlSubFolder = subFolderParts
      .map((p) => encodeURIComponent(p))
      .join('/');
    const publicUrl = `${this.config.appUrl}/public/uploads/${urlSubFolder ? urlSubFolder + '/' : ''}${filename}`;

    await this.drizzle.db.insert(schema.berkas).values({
      nama: namaBerkas,
      url: publicUrl,
      mimetype,
      keterangan: caption || `Uploaded by ${chatId}`,
      isPublic: false, // Default private
      uploadedBy: participant || chatId,
    });

    // 5. Beri Notifikasi (Kecuali Dosen - Silent Save)
    if (senderType !== 'dosen') {
      await this.waSender.sendText({
        chatId,
        text: `[BERHASIL] File berhasil disimpan!\n\nNama: *${namaBerkas}*\n\n_(File bersifat private secara default)_\n\nGunakan command:\n*${prefix}file send ${namaBerkas} doc* (untuk ambil file)\n*${prefix}file share ${namaBerkas} public* (untuk membagikan link publik)`,
        reply_to: messageId,
      });
    }
  }
}
