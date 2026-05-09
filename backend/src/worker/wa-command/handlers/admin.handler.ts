import { AppConfigService } from '@/common/config/config.service';
import { DrizzleService } from '@/db/drizzle.service';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

// ─── Tabel yang DILARANG di-query (kritis/sensitif) ─────────────────────────
const BLOCKED_TABLES = new Set([
  'user', // API key auth
  'session', // session data
  'migrations', // internal drizzle
  '__drizzle_migrations',
]);

// ─── Field yang disensor dalam hasil query ───────────────────────────────────
const SENSITIVE_FIELDS = new Set([
  'password',
  'api_key',
  'apikey',
  'token',
  'secret',
  'hash',
  'salt',
  'refresh_token',
  'access_token',
  'private_key',
]);

/**
 * Sensor nilai field sensitif pada array of objects hasil query.
 */
function sanitizeRows(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map((row) => {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  });
}

// Baris maksimal yang ditampilkan ke WA
const MAX_DISPLAY_ROWS = 16;

/**
 * Format rows menjadi teks WhatsApp-friendly (tabel plain text).
 * Menampilkan semua baris yang dikembalikan DB, maks MAX_DISPLAY_ROWS.
 */
function formatRows(
  rows: Record<string, any>[],
  queryLabel: string,
  totalFromDb: number,
): string {
  if (rows.length === 0) return `_(Tidak ada data untuk query: ${queryLabel})_`;

  const keys = Object.keys(rows[0]);
  const maxKeyLen = Math.max(...keys.map((k) => k.length));

  const lines = rows.map((row, i) => {
    const values = keys
      .map((k) => {
        const padded = k.padEnd(maxKeyLen);
        const raw = row[k];

        let display: string;
        if (raw === null || raw === undefined) {
          display = '_null_';
        } else if (typeof raw === 'object') {
          // Object/array (termasuk kolom JSON dari hasil JOIN aggregate)
          // di-indent agar kelihatan nested di WA
          display =
            '\n' +
            JSON.stringify(raw, null, 2)
              .split('\n')
              .map((l) => `    ${l}`)
              .join('\n');
        } else if (typeof raw === 'string' && raw.length > 80) {
          display = `"${raw.slice(0, 77)}..."`;
        } else {
          display = JSON.stringify(raw);
        }

        return `  ${padded} : ${display}`;
      })
      .join('\n');

    return `━━ [${i + 1}] ━━\n${values}`;
  });

  const suffix =
    totalFromDb > rows.length
      ? `\n\n_... dan ${totalFromDb - rows.length} baris lainnya tidak ditampilkan._\n_Tambahkan LIMIT N di query untuk mengubah jumlah baris._`
      : '';

  return (
    `*Query: ${queryLabel}*\n` +
    `Total DB: ${totalFromDb} | Tampil: ${rows.length}\n\n` +
    lines.join('\n\n') +
    suffix
  );
}

@Injectable()
export class AdminHandler {
  private readonly logger = new Logger(AdminHandler.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * Entry point utama handler admin.
   * Dipanggil dari wa-command.service jika command === 'admin'.
   */
  async handle(
    chatId: string,
    senderId: string,
    args: string[],
    reply_to?: string,
  ) {
    // ── Guard: hanya admin ─────────────────────────────────────────────────
    const isAdmin = this.config.adminNumbers.some((n) => senderId.includes(n));
    if (!isAdmin) {
      await this.waSender.sendText({
        chatId,
        text: '[DITOLAK] Perintah ini hanya untuk Admin / Developer.',
        reply_to,
      });
      return;
    }

    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'query':
        return this.handleQuery(chatId, args.slice(1), reply_to);

      default:
        return this.sendHelp(chatId, reply_to);
    }
  }

  // ─── Sub-command: .admin query [tabel] [kondisi_sql?] ──────────────────────
  private async handleQuery(chatId: string, args: string[], reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;

    // Validasi: minimal ada nama tabel
    if (args.length === 0) {
      await this.waSender.sendText({
        chatId,
        text:
          `Format salah!\n\n` +
          `Contoh:\n` +
          `*${prefix}admin query mahasiswa*\n` +
          `*${prefix}admin query dosen WHERE nip = '12345'*`,
        reply_to,
      });
      return;
    }

    const tableName = args[0].toLowerCase();

    // ── Cek tabel kritis (termasuk dalam klausa JOIN) ────────────────────────
    // Scan seluruh teks query, bukan hanya nama tabel pertama,
    // untuk mencegah bypass seperti: .admin query dosen JOIN user ON ...
    const fullClauseForCheck = args.join(' ').toLowerCase();
    for (const blocked of BLOCKED_TABLES) {
      // Cek sebagai kata utuh (word boundary)
      const pattern = new RegExp(`\\b${blocked}\\b`);
      if (pattern.test(fullClauseForCheck)) {
        await this.waSender.sendText({
          chatId,
          text: `[DIBLOKIR] Tabel *${blocked}* tidak boleh di-query atau di-JOIN melalui perintah ini.`,
          reply_to,
        });
        return;
      }
    }

    // ── Susun query ─────────────────────────────────────────────────────────
    // args[1..] = klausa tambahan (WHERE / JOIN / ORDER BY / LIMIT)
    // Hanya SELECT yang diizinkan
    const extraClause = args.slice(1).join(' ').trim();
    const forbiddenKeywords =
      /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b/i;

    if (forbiddenKeywords.test(extraClause)) {
      await this.waSender.sendText({
        chatId,
        text: '[DIBLOKIR] Hanya query SELECT yang diizinkan.',
        reply_to,
      });
      return;
    }

    // Cek apakah user sudah tulis LIMIT sendiri
    const hasLimit = /\blimit\s+\d+/i.test(extraClause);
    // Jika sudah ada LIMIT, pakai milik user (kita batasi maks 100 di sisi aplikasi)
    // Jika belum, tambahkan LIMIT 50 sebagai default
    const rawQuery = extraClause
      ? `SELECT * FROM ${tableName} ${extraClause}${hasLimit ? '' : ' LIMIT 50'}`
      : `SELECT * FROM ${tableName} LIMIT 50`;

    try {
      this.logger.log(`[ADMIN QUERY] ${rawQuery}`);
      const result = await this.drizzle.db.execute(sql.raw(rawQuery));
      const allRows = result.rows as Record<string, any>[];

      // Batasi tampilan ke MAX_DISPLAY_ROWS, tapi DB bisa kembalikan lebih
      const displayRows = sanitizeRows(allRows.slice(0, MAX_DISPLAY_ROWS));
      const text = formatRows(displayRows, tableName, allRows.length);

      await this.waSender.sendText({ chatId, text, reply_to });
    } catch (error) {
      this.logger.error(`[ADMIN QUERY ERROR]`, error);
      await this.waSender.sendText({
        chatId,
        text: `[ERROR] Query gagal: ${error instanceof Error ? error.message : String(error)}`,
        reply_to,
      });
    }
  }

  // ─── Help ───────────────────────────────────────────────────────────────────
  private async sendHelp(chatId: string, reply_to?: string) {
    const prefix = this.config.wahaCommandPrefix;
    await this.waSender.sendText({
      chatId,
      text:
        `*MENU ADMIN / DEVELOPER*\n\n` +
        `Perintah berikut hanya bisa digunakan oleh Admin terdaftar.\n\n` +
        `*Query dasar:*\n` +
        `*${prefix}admin query [tabel]*\n` +
        `  Contoh: *${prefix}admin query mahasiswa*\n\n` +
        `*Query dengan filter:*\n` +
        `*${prefix}admin query [tabel] WHERE [kondisi]*\n` +
        `  Contoh: *${prefix}admin query dosen WHERE nama LIKE '%budi%'*\n\n` +
        `*Query dengan JOIN:*\n` +
        `*${prefix}admin query [tabel] JOIN [tabel2] ON [kondisi]*\n` +
        `  Contoh: *${prefix}admin query mahasiswa JOIN mahasiswa_grup ON mahasiswa.id = mahasiswa_grup.mahasiswa_id*\n\n` +
        `*Custom row count (default 50, maks ditampilkan ${MAX_DISPLAY_ROWS}):*\n` +
        `*${prefix}admin query [tabel] LIMIT 32*\n\n` +
        `Tabel: dosen, mahasiswa, grup, mata_kuliah, jadwal_mata_kuliah, grup_jadwal, reminder_log, berkas, pengaturan\n\n` +
        `_Atribut sensitif (api_key, token, dll) disensor otomatis._\n` +
        `_Tabel kritis (user, session, migrations) tidak bisa di-query/JOIN._`,
      reply_to,
    });
  }
}
