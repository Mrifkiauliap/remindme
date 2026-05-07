import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { and, asc, eq } from 'drizzle-orm';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class ScheduleHandler {
  private readonly logger = new Logger(ScheduleHandler.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  async handleJadwal(
    chatId: string,
    args: string[],
    isGroup: boolean,
    reply_to?: string,
  ) {
    const subCommand = args[0]?.toLowerCase();
    const prefix = this.config.wahaCommandPrefix;

    if (!isGroup) {
      await this.waSender.sendText({
        chatId,
        text: '❌ Fitur jadwal saat ini hanya bisa digunakan di dalam grup kelas.',
        reply_to,
      });
      return;
    }

    if (subCommand === 'tambah' || subCommand === 'add') {
      return this.handleAddJadwal(chatId, args.slice(1), reply_to);
    } else if (subCommand === 'hari_ini' || subCommand === 'today') {
      return this.handleListJadwal(chatId, reply_to, 'hari_ini');
    } else if (subCommand === 'besok' || subCommand === 'tomorrow') {
      return this.handleListJadwal(chatId, reply_to, 'besok');
    } else {
      await this.waSender.sendText({
        chatId,
        text: `*Menu Jadwal:*\n\n1. *${prefix}jadwal hari_ini*\n   Melihat jadwal kuliah & reminder grup ini hari ini.\n2. *${prefix}jadwal besok*\n   Melihat jadwal kuliah besok.\n3. *${prefix}jadwal tambah [KodeMatkul] [NIP_Dosen] [Hari] [JamMulai-JamSelesai] [Ruangan]*\n   Menambahkan jadwal baru.\n   Contoh: *${prefix}jadwal tambah IF101 DSN001 Senin 08:00-10:00 R.A1*`,
        reply_to,
      });
    }
  }

  private async handleAddJadwal(
    chatId: string,
    args: string[],
    reply_to?: string,
  ) {
    const prefix = this.config.wahaCommandPrefix;

    // Expected args: [KodeMatkul] [NIP_Dosen] [Hari] [JamMulai-JamSelesai] [Ruangan]
    if (args.length < 5) {
      await this.waSender.sendText({
        chatId,
        text: `Format salah!\n\nContoh yang benar:\n*${prefix}jadwal tambah IF101 DSN001 Senin 08:00-10:00 R.A1*`,
        reply_to,
      });
      return;
    }

    const kodeMatkul = args[0];
    const nipDosen = args[1];
    const hari =
      args[2].charAt(0).toUpperCase() + args[2].slice(1).toLowerCase(); // capitalize
    const jam = args[3];
    const ruangan = args.slice(4).join(' '); // Ruangan might have spaces

    if (
      ![
        'Senin',
        'Selasa',
        'Rabu',
        'Kamis',
        'Jumat',
        'Sabtu',
        'Minggu',
      ].includes(hari)
    ) {
      await this.waSender.sendText({
        chatId,
        text: `❌ Hari *${hari}* tidak valid. Gunakan nama hari dalam bahasa Indonesia.`,
        reply_to,
      });
      return;
    }

    const [jamMulai, jamSelesai] = jam.split('-');
    if (!jamMulai || !jamSelesai) {
      await this.waSender.sendText({
        chatId,
        text: `❌ Format jam salah. Gunakan format *HH:MM-HH:MM* (misal: 08:00-10:00).`,
        reply_to,
      });
      return;
    }

    // 1. Get Grup
    const [grup] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.nomorWa, chatId))
      .limit(1);

    if (!grup) {
      await this.waSender.sendText({
        chatId,
        text: '❌ Grup ini belum terdaftar di sistem.',
        reply_to,
      });
      return;
    }

    // 2. Get Matkul
    const [matkul] = await this.drizzle.db
      .select()
      .from(schema.mataKuliah)
      .where(eq(schema.mataKuliah.kode, kodeMatkul))
      .limit(1);

    if (!matkul) {
      await this.waSender.sendText({
        chatId,
        text: `❌ Mata kuliah dengan kode *${kodeMatkul}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    // 3. Get Dosen
    const [dosen] = await this.drizzle.db
      .select()
      .from(schema.dosen)
      .where(eq(schema.dosen.nip, nipDosen))
      .limit(1);

    if (!dosen) {
      await this.waSender.sendText({
        chatId,
        text: `❌ Dosen dengan NIP *${nipDosen}* tidak ditemukan.`,
        reply_to,
      });
      return;
    }

    // 4. Insert Jadwal
    try {
      await this.drizzle.db.insert(schema.jadwalMataKuliah).values({
        grupId: grup.id,
        mataKuliahId: matkul.id,
        dosenId: dosen.id,
        hari: hari as any,
        jamMulai: `${jamMulai}:00`,
        jamSelesai: `${jamSelesai}:00`,
        ruangan: ruangan,
        isActive: true,
      });

      await this.waSender.sendText({
        chatId,
        text: `✅ *Jadwal Berhasil Ditambahkan!*\n\nMatkul: ${matkul.nama}\nDosen: ${dosen.nama}\nHari: ${hari}\nWaktu: ${jamMulai} - ${jamSelesai}\nRuangan: ${ruangan}\n\nPengingat kelas otomatis aktif untuk jadwal ini.`,
        reply_to,
      });
    } catch (e) {
      this.logger.error(e);
      await this.waSender.sendText({
        chatId,
        text: `❌ Gagal menambahkan jadwal: Terjadi kesalahan di server.`,
        reply_to,
      });
    }
  }

  private async handleListJadwal(
    chatId: string,
    reply_to?: string,
    type: 'hari_ini' | 'besok' = 'hari_ini',
  ) {
    // Dapatkan grup ID
    const [grup] = await this.drizzle.db
      .select()
      .from(schema.grup)
      .where(eq(schema.grup.nomorWa, chatId))
      .limit(1);

    if (!grup) {
      await this.waSender.sendText({
        chatId,
        text: '❌ Grup ini belum terdaftar di sistem.',
        reply_to,
      });
      return;
    }

    let now = dayjs();
    if (type === 'besok') {
      now = now.add(1, 'day');
    }

    const hariIndo = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
    ];
    const hariTarget = hariIndo[now.day()] as any;

    const jadwals = await this.drizzle.db.query.jadwalMataKuliah.findMany({
      where: and(
        eq(schema.jadwalMataKuliah.grupId, grup.id),
        eq(schema.jadwalMataKuliah.hari, hariTarget),
        eq(schema.jadwalMataKuliah.isActive, true),
      ),
      with: {
        mataKuliah: true,
        dosen: true,
      },
      orderBy: [asc(schema.jadwalMataKuliah.jamMulai)],
    });

    if (jadwals.length === 0) {
      await this.waSender.sendText({
        chatId,
        text: `Tidak ada jadwal perkuliahan untuk *${type === 'hari_ini' ? 'Hari Ini' : 'Besok'}* (${hariTarget}).`,
        reply_to,
      });
      return;
    }

    const listText = jadwals
      .map((j, i) => {
        return `${i + 1}. *${j.mataKuliah.nama}*\n   Dosen: ${j.dosen.nama}\n   Waktu: ${j.jamMulai.slice(0, 5)} - ${j.jamSelesai.slice(0, 5)}\n   Ruangan: ${j.ruangan || '-'}`;
      })
      .join('\n\n');

    await this.waSender.sendText({
      chatId,
      text: `*Jadwal Kuliah ${type === 'hari_ini' ? 'Hari Ini' : 'Besok'} (${hariTarget}):*\n\n${listText}\n\n_Sistem akan otomatis mengirimkan reminder sebelum jam kuliah dimulai._`,
      reply_to,
    });
  }

  async handleDosen(chatId: string, args: string[], reply_to?: string) {
    // TODO: Implementasi logika cari dosen
    await this.waSender.sendText({
      chatId,
      text: `[DUMMY] Menampilkan informasi dosen...\n(Segera hadir...)`,
      reply_to,
    });
  }
}
