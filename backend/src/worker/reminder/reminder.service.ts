import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import { hariEnum, jadwalMataKuliah, reminderLog } from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { WaSenderService } from '../wa-sender/wa-sender.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly waSender: WaSenderService,
  ) {}

  findAll() {
    return this.drizzle.db.query.reminderLog.findMany({
      with: { jadwal: true },
      orderBy: [desc(reminderLog.createdAt)],
      limit: 100,
    });
  }

  findOne(id: number) {
    return this.drizzle.db.query.reminderLog.findFirst({
      where: eq(reminderLog.id, id),
      with: { jadwal: true },
    });
  }

  // Cron job jalan tiap 10 menit, jam 07.00 - 18.00, Senin - Sabtu
  @Cron('0 */10 7-18 * * 1-6')
  async handleCron() {
    this.logger.log('Menjalankan cron job reminder jadwal kuliah...');

    // 1. Tentukan waktu saat ini dan target pencarian maksimal (120 menit ke depan, sesuai batas maksimal setting)
    const now = dayjs();
    const maxTargetTime = now.add(120, 'minute');

    // Mapping format jam postgres (HH:MM:SS)
    const nowTimeStr = now.format('HH:mm:00');
    const maxTargetTimeStr = maxTargetTime.format('HH:mm:00');

    // Dapatkan hari ini dalam string Enum ('Senin', 'Selasa', dst)
    const hariIndo = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
    ];
    const hariIni = hariIndo[now.day()] as (typeof hariEnum.enumValues)[number];

    if (hariIni === 'Minggu') {
      return; // Hanya abaikan hari Minggu
    }

    try {
      // 2. Query jadwal yang hari ini dan jamMulai antara sekarang s.d 30 menit ke depan
      // Serta join ke dosen dan grup (untuk ambil mahasiswa)
      const jadwals = await this.drizzle.db.query.jadwalMataKuliah.findMany({
        where: and(
          eq(jadwalMataKuliah.hari, hariIni),
          eq(jadwalMataKuliah.isActive, true),
          gte(jadwalMataKuliah.jamMulai, nowTimeStr),
          lte(jadwalMataKuliah.jamMulai, maxTargetTimeStr),
        ),
        with: {
          dosen: true,
          mataKuliah: true,
          grupJadwals: {
            with: {
              grup: {
                with: { mahasiswaGrups: { with: { mahasiswa: true } } },
              },
            },
          },
        },
      });

      if (jadwals.length === 0) {
        return;
      }

      this.logger.log(
        `Ditemukan ${jadwals.length} jadwal dalam 120 menit ke depan. Memeriksa pengaturan grup...`,
      );

      // 3. Proses pengiriman reminder
      for (const jadwal of jadwals) {
        // Cek apakah hari ini sudah pernah dikirim reminder untuk jadwal ini
        const today = dayjs().startOf('day').toDate();

        const alreadySent = await this.drizzle.db.query.reminderLog.findFirst({
          where: and(
            eq(reminderLog.jadwalId, jadwal.id),
            eq(reminderLog.status, 'sent'),
            gte(reminderLog.createdAt, today),
          ),
        });

        if (alreadySent) {
          continue; // Lewati jika sudah dikirim hari ini
        }

        // Cek sisa waktu
        const [h, m, s] = jadwal.jamMulai.split(':');
        const scheduleTime = now
          .hour(parseInt(h))
          .minute(parseInt(m))
          .second(parseInt(s))
          .millisecond(0);
        const timeDiffMinutes = scheduleTime.diff(now, 'minute', true);

        const pesan = `*REMINDER KULIAH*\n\nMata Kuliah: ${jadwal.mataKuliah.nama}\nDosen: ${jadwal.dosen.nama}\nRuangan: ${jadwal.ruangan}\nWaktu: ${jadwal.jamMulai}\n\nMohon bersiap-siap.`;

        // Kirim ke semua grup terkait
        for (const gj of jadwal.grupJadwals) {
          const grupObj = gj.grup;
          if (!grupObj) continue;

          // Cek pengaturan reminder untuk grup ini
          const pengaturanGrup =
            await this.drizzle.db.query.pengaturan.findMany({
              where: eq(schema.pengaturan.grupId, grupObj.id),
            });
          const activeSetting = pengaturanGrup.find(
            (p) => p.key === 'reminder_active',
          );
          const isReminderActive = activeSetting
            ? activeSetting.value === 'true'
            : true;

          if (!isReminderActive) continue;

          const leadTimeSetting = pengaturanGrup.find(
            (p) => p.key === 'reminder_lead_time',
          );
          const leadTimeMinutes = leadTimeSetting
            ? parseInt(leadTimeSetting.value, 10)
            : 30;

          if (timeDiffMinutes > leadTimeMinutes || timeDiffMinutes < 0) {
            continue; // Lewati jika belum saatnya atau sudah lewat
          }

          if (grupObj.nomorWa) {
            const success = await this.waSender.sendText({
              chatId: grupObj.nomorWa,
              text: pesan,
            });

            await this.drizzle.db.insert(reminderLog).values({
              jadwalId: jadwal.id,
              targetType: 'grup',
              targetId: grupObj.id,
              nomorWa: grupObj.nomorWa,
              pesan: pesan,
              status: success ? 'sent' : 'failed',
              sentAt: success ? dayjs().toDate() : null,
            });
          } else {
            // Fallback kirim ke masing-masing mahasiswa jika grup tidak punya WA
            for (const mhsGrup of grupObj.mahasiswaGrups) {
              const mhs = mhsGrup.mahasiswa;
              if (!mhs || !mhs.nomorWa) continue;
              const success = await this.waSender.sendText({
                chatId: mhs.nomorWa,
                text: pesan,
              });
              await this.drizzle.db.insert(reminderLog).values({
                jadwalId: jadwal.id,
                targetType: 'mahasiswa',
                targetId: mhs.id,
                nomorWa: mhs.nomorWa,
                pesan: pesan,
                status: success ? 'sent' : 'failed',
                sentAt: success ? dayjs().toDate() : null,
              });
            }
          }
        }

        // Kirim ke Dosen
        if (jadwal.dosen.nomorWa) {
          const success = await this.waSender.sendText({
            chatId: jadwal.dosen.nomorWa,
            text: `*REMINDER MENGAJAR*\n\nMata Kuliah: ${jadwal.mataKuliah.nama}\nRuangan: ${jadwal.ruangan}\nWaktu: ${jadwal.jamMulai}\n\nJadwal mengajar Anda akan segera dimulai.`,
          });

          await this.drizzle.db.insert(reminderLog).values({
            jadwalId: jadwal.id,
            targetType: 'dosen',
            targetId: jadwal.dosen.id,
            nomorWa: jadwal.dosen.nomorWa,
            pesan: pesan,
            status: success ? 'sent' : 'failed',
            sentAt: success ? dayjs().toDate() : null,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error eksekusi cron: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
