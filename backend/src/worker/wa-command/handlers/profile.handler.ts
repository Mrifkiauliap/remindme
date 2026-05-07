import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable } from '@nestjs/common';
import { eq, or } from 'drizzle-orm';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class ProfileHandler {
  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  private formatWaNumber(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('08')) {
      clean = '628' + clean.slice(2);
    }
    if (!clean.endsWith('@c.us')) {
      clean = `${clean}@c.us`;
    }
    return clean;
  }

  async handleDaftar(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    const isGroup = chatId.includes('@g.us');

    if (isGroup) {
      // Pendaftaran via grup hanya untuk .daftar dosen (jika admin)
      // Tapi lebih baik diarahkan ke DM saja agar rapi
    }

    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah.\n\n*Mahasiswa:*\n${prefix}daftar [Nama Lengkap]\nContoh: ${prefix}daftar Budi Santoso\n\n*Admin (Daftar Dosen):*\n${prefix}daftar dosen [Nomor HP] [NIP/-] [Nama Lengkap]\nContoh: ${prefix}daftar dosen 08123456789 19800101 Pak Guru`,
        reply_to,
      });
      return;
    }

    const subCommand = args[0]?.toLowerCase();

    // 1. Pendaftaran Dosen (Oleh Admin)
    if (subCommand === 'dosen') {
      const isAdmin = this.config.adminNumbers.some((n) => chatId.includes(n));
      if (!isAdmin) {
        await this.waSender.sendText({
          chatId,
          text: '[ERROR] Hanya Admin yang dapat mendaftarkan dosen.',
          reply_to,
        });
        return;
      }

      if (args.length < 4) {
        await this.waSender.sendText({
          chatId,
          text: `Format salah!\nGunakan: *${prefix}daftar dosen [Nomor HP] [NIP atau -] [Nama Lengkap]*\nContoh: ${prefix}daftar dosen 08123456789 19800101 Pak Budi`,
          reply_to,
        });
        return;
      }

      const nomorHp = args[1];
      const nipInput = args[2];
      const namaDosen = args.slice(3).join(' ');

      const nomorWaDosen = this.formatWaNumber(nomorHp);
      // Generate dummy NIP jika diisi '-' (karena NIP notNull & unique di DB)
      const nip =
        nipInput === '-' ? `DSN-${Date.now().toString().slice(-6)}` : nipInput;

      // Cek apakah dosen sudah ada
      const existingDosen = await this.drizzle.db.query.dosen.findFirst({
        where: or(
          eq(schema.dosen.nomorWa, nomorWaDosen),
          eq(schema.dosen.nip, nip),
        ),
      });

      if (existingDosen) {
        await this.waSender.sendText({
          chatId,
          text: `[ERROR] Dosen dengan Nomor WA atau NIP tersebut sudah terdaftar sebagai *${existingDosen.nama}*.`,
          reply_to,
        });
        return;
      }

      await this.drizzle.db.insert(schema.dosen).values({
        nama: namaDosen,
        nomorWa: nomorWaDosen,
        nip: nip,
      });

      await this.waSender.sendText({
        chatId,
        text: `[BERHASIL] Dosen *${namaDosen}* berhasil didaftarkan dengan nomor WA ${nomorWaDosen}.`,
        reply_to,
      });
      return;
    }

    // 2. Pendaftaran Mahasiswa (Mandiri)
    const namaMahasiswa = args.join(' ');
    const nomorWa = chatId;

    // Gunakan nomor WA (tanpa domain @c.us/@lid) sebagai fallback NIM, max 20 char
    const cleanId = chatId.split('@')[0];
    const nim = `MHS-${cleanId}`.substring(0, 20);

    const existingMhs = await this.drizzle.db.query.mahasiswa.findFirst({
      where: eq(schema.mahasiswa.nomorWa, nomorWa),
    });

    if (existingMhs) {
      await this.waSender.sendText({
        chatId,
        text: `Anda sudah terdaftar sebagai *${existingMhs.nama}*.`,
        reply_to,
      });
      return;
    }

    await this.drizzle.db.insert(schema.mahasiswa).values({
      nama: namaMahasiswa,
      nomorWa: nomorWa,
      nim: nim,
    });

    await this.waSender.sendText({
      chatId,
      text: `[BERHASIL] Anda berhasil terdaftar sebagai Mahasiswa dengan nama *${namaMahasiswa}*.`,
      reply_to,
    });
  }

  async handleMe(chatId: string, args: string[], reply_to?: string) {
    const mhs = await this.drizzle.db.query.mahasiswa.findFirst({
      where: eq(schema.mahasiswa.nomorWa, chatId),
    });

    if (mhs) {
      await this.waSender.sendText({
        chatId,
        text: `*Profil Mahasiswa*\nNama: ${mhs.nama}\nID Sistem: ${mhs.nim}`,
        reply_to,
      });
      return;
    }

    const dsn = await this.drizzle.db.query.dosen.findFirst({
      where: eq(schema.dosen.nomorWa, chatId),
    });

    if (dsn) {
      await this.waSender.sendText({
        chatId,
        text: `*Profil Dosen*\nNama: ${dsn.nama}\nNIP: ${dsn.nip}`,
        reply_to,
      });
      return;
    }

    await this.waSender.sendText({
      chatId,
      text: `Anda belum terdaftar di sistem. Silakan daftar menggunakan perintah *.daftar [Nama]*`,
      reply_to,
    });
  }
}
