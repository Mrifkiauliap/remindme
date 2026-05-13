import { DrizzleService } from '@/db/drizzle.service';
import { hariEnum, jadwalMataKuliah, reminderLog } from '@/db/schema/schema';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { WaSenderService } from '../wa-sender/wa-sender.service';

// Pastikan plugin timezone aktif di konteks ini
dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Jakarta';

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

    // 1. Tentukan waktu saat ini dalam timezone WIB
    const now = dayjs().tz(TIMEZONE);
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

    this.logger.log(
      `Waktu WIB: ${now.format('HH:mm')} | Hari: ${hariIni} | Window: ${nowTimeStr} - ${maxTargetTimeStr}`,
    );

    try {
      // 2. Ambil semua pengaturan sekaligus → build Map<grupId, { isActive, leadTime }>
      //    Ini menggantikan query per-grup di dalam loop (N queries → 1 query)
      const allPengaturan = await this.drizzle.db.query.pengaturan.findMany();
      const pengaturanMap = new Map<
        number,
        { isActive: boolean; leadTime: number }
      >();
      for (const p of allPengaturan) {
        if (p.grupId === null) continue;
        const existing = pengaturanMap.get(p.grupId) ?? {
          isActive: true,
          leadTime: 30,
        };
        if (p.key === 'reminder_active') {
          existing.isActive = p.value === 'true';
        } else if (p.key === 'reminder_lead_time') {
          existing.leadTime = parseInt(p.value, 10);
        }
        pengaturanMap.set(p.grupId, existing);
      }

      // 3. Query jadwal yang hari ini dan jamMulai antara sekarang s.d 120 menit ke depan
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
        this.logger.log('Tidak ada jadwal dalam window waktu ini.');
        return;
      }

      this.logger.log(
        `Ditemukan ${jadwals.length} jadwal dalam 120 menit ke depan. Memeriksa pengaturan grup...`,
      );

      // Batas awal hari ini (WIB) untuk filter duplikasi
      const todayStart = now.startOf('day').toDate();

      // 3. Proses pengiriman reminder per jadwal
      for (const jadwal of jadwals) {
        // Hitung sisa waktu menuju jadwal mulai (dalam menit)
        const [h, m, s] = jadwal.jamMulai.split(':');
        const scheduleTime = now
          .hour(parseInt(h))
          .minute(parseInt(m))
          .second(parseInt(s))
          .millisecond(0);
        const timeDiffMinutes = scheduleTime.diff(now, 'minute', true);

        const jamFormatted = jadwal.jamMulai.slice(0, 5); // "09:00:00" → "09:00"
        const sisaMenit = Math.round(timeDiffMinutes);

        const pesanMahasiswa =
          `*REMINDER KULIAH*\n\n` +
          `*${jadwal.mataKuliah.nama}*\n` +
          `Dosen   : ${jadwal.dosen.nama}\n` +
          `Ruangan : ${jadwal.ruangan ?? '-'}\n` +
          `Waktu   : ${jamFormatted}\n` +
          `Hari    : ${hariIni}, ${now.format('DD/MM/YYYY')}\n\n` +
          `Kuliah dimulai *${sisaMenit} menit lagi*.\n` +
          `Mohon bersiap-siap!`;

        const pesanDosen =
          `*REMINDER MENGAJAR*\n\n` +
          `*${jadwal.mataKuliah.nama}*\n` +
          `Ruangan : ${jadwal.ruangan ?? '-'}\n` +
          `Waktu   : ${jamFormatted}\n` +
          `Hari    : ${hariIni}, ${now.format('DD/MM/YYYY')}\n\n` +
          `Jadwal mengajar dimulai *${sisaMenit} menit lagi*.\n` +
          `Semangat mengajar!`;

        // ── Kirim ke Grup / Mahasiswa ─────────────────────────────────────────
        for (const gj of jadwal.grupJadwals) {
          const grupObj = gj.grup;
          if (!grupObj) continue;

          // Lookup pengaturan dari Map (O(1), sudah di-fetch sekali di atas)
          const setting = pengaturanMap.get(grupObj.id) ?? {
            isActive: true,
            leadTime: 30,
          };

          if (!setting.isActive) continue;

          const leadTimeMinutes = setting.leadTime;

          // Lewati jika belum waktunya atau sudah lewat
          if (timeDiffMinutes > leadTimeMinutes || timeDiffMinutes < 0) {
            this.logger.debug(
              `Jadwal #${jadwal.id} grup #${grupObj.id}: sisa ${timeDiffMinutes.toFixed(1)} menit, leadTime ${leadTimeMinutes} menit — dilewati.`,
            );
            continue;
          }

          if (grupObj.nomorWa && grupObj.nomorWa !== '0') {
            // Cek duplikasi per jadwal + target grup
            const alreadySentGrup =
              await this.drizzle.db.query.reminderLog.findFirst({
                where: and(
                  eq(reminderLog.jadwalId, jadwal.id),
                  eq(reminderLog.targetType, 'grup'),
                  eq(reminderLog.targetId, grupObj.id),
                  eq(reminderLog.status, 'sent'),
                  gte(reminderLog.createdAt, todayStart),
                ),
              });

            if (alreadySentGrup) {
              this.logger.debug(
                `Reminder grup #${grupObj.id} untuk jadwal #${jadwal.id} sudah terkirim hari ini.`,
              );
              continue;
            }

            const success = await this.waSender.sendText({
              chatId: grupObj.nomorWa,
              text: pesanMahasiswa,
            });

            await this.drizzle.db.insert(reminderLog).values({
              jadwalId: jadwal.id,
              targetType: 'grup',
              targetId: grupObj.id,
              nomorWa: grupObj.nomorWa,
              pesan: pesanMahasiswa,
              status: success ? 'sent' : 'failed',
              sentAt: success ? dayjs().toDate() : null,
            });

            this.logger.log(
              `Reminder grup "${grupObj.namaGrup}" → ${success ? 'TERKIRIM' : 'GAGAL'}`,
            );
          } else {
            // Fallback: kirim ke masing-masing mahasiswa jika grup tidak punya WA
            for (const mhsGrup of grupObj.mahasiswaGrups) {
              const mhs = mhsGrup.mahasiswa;
              if (!mhs || !mhs.nomorWa || mhs.nomorWa === '0') continue;

              // Cek duplikasi per jadwal + target mahasiswa
              const alreadySentMhs =
                await this.drizzle.db.query.reminderLog.findFirst({
                  where: and(
                    eq(reminderLog.jadwalId, jadwal.id),
                    eq(reminderLog.targetType, 'mahasiswa'),
                    eq(reminderLog.targetId, mhs.id),
                    eq(reminderLog.status, 'sent'),
                    gte(reminderLog.createdAt, todayStart),
                  ),
                });

              if (alreadySentMhs) continue;

              const success = await this.waSender.sendText({
                chatId: mhs.nomorWa,
                text: pesanMahasiswa,
              });

              await this.drizzle.db.insert(reminderLog).values({
                jadwalId: jadwal.id,
                targetType: 'mahasiswa',
                targetId: mhs.id,
                nomorWa: mhs.nomorWa,
                pesan: pesanMahasiswa,
                status: success ? 'sent' : 'failed',
                sentAt: success ? dayjs().toDate() : null,
              });
            }
          }
        }

        // ── Kirim ke Dosen ────────────────────────────────────────────────────
        if (jadwal.dosen.nomorWa && jadwal.dosen.nomorWa !== '0') {
          // Dosen pakai lead time default 30 menit
          const dosenLeadTime = 30;
          if (timeDiffMinutes > dosenLeadTime || timeDiffMinutes < 0) {
            continue;
          }

          // Cek duplikasi reminder dosen hari ini
          const alreadySentDosen =
            await this.drizzle.db.query.reminderLog.findFirst({
              where: and(
                eq(reminderLog.jadwalId, jadwal.id),
                eq(reminderLog.targetType, 'dosen'),
                eq(reminderLog.targetId, jadwal.dosen.id),
                eq(reminderLog.status, 'sent'),
                gte(reminderLog.createdAt, todayStart),
              ),
            });

          if (alreadySentDosen) {
            this.logger.debug(
              `Reminder dosen #${jadwal.dosen.id} untuk jadwal #${jadwal.id} sudah terkirim hari ini.`,
            );
            continue;
          }

          const success = await this.waSender.sendText({
            chatId: jadwal.dosen.nomorWa,
            text: pesanDosen,
          });

          await this.drizzle.db.insert(reminderLog).values({
            jadwalId: jadwal.id,
            targetType: 'dosen',
            targetId: jadwal.dosen.id,
            nomorWa: jadwal.dosen.nomorWa,
            pesan: pesanDosen,
            status: success ? 'sent' : 'failed',
            sentAt: success ? dayjs().toDate() : null,
          });

          this.logger.log(
            `Reminder dosen "${jadwal.dosen.nama}" → ${success ? 'TERKIRIM' : 'GAGAL'}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error eksekusi cron: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
