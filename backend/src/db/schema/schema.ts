import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  time,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// ─── Timestamps Helper ────────────────────────────────────────────────────────
export const timestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

// ─── Enums ───────────────────────────────────────────────────────────────────
export const hariEnum = pgEnum('hari', [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
]);

export const reminderStatusEnum = pgEnum('reminder_status', [
  'pending',
  'sent',
  'failed',
]);

export const targetTypeEnum = pgEnum('target_type', [
  'mahasiswa',
  'dosen',
  'grup',
]);

// ─── User (API Key Auth) ──────────────────────────────────────────────────────
export const user = pgTable('user', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

// ─── Dosen ────────────────────────────────────────────────────────────────────
export const dosen = pgTable('dosen', {
  id: serial('id').primaryKey(),
  nip: varchar('nip', { length: 30 }).notNull().unique(),
  nama: varchar('nama', { length: 150 }).notNull(),
  nomorWa: varchar('nomor_wa', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }),
  ...timestamps,
});

export const dosenGrup = pgTable(
  'dosen_grup',
  {
    dosenId: integer('dosen_id')
      .notNull()
      .references(() => dosen.id, { onDelete: 'cascade' }),
    grupId: integer('grup_id')
      .notNull()
      .references(() => grup.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.dosenId, t.grupId] }),
  }),
);

// ─── Mahasiswa ────────────────────────────────────────────────────────────────
export const mahasiswa = pgTable('mahasiswa', {
  id: serial('id').primaryKey(),
  nim: varchar('nim', { length: 20 }).notNull().unique(),
  nama: varchar('nama', { length: 150 }).notNull(),
  nomorWa: varchar('nomor_wa', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }),
  ...timestamps,
});

// ─── Mahasiswa Grup ────────────────────────────────────────────────────────────────
export const mahasiswaGrup = pgTable(
  'mahasiswa_grup',
  {
    mahasiswaId: integer('mahasiswa_id')
      .notNull()
      .references(() => mahasiswa.id, { onDelete: 'cascade' }),
    grupId: integer('grup_id')
      .notNull()
      .references(() => grup.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.mahasiswaId, t.grupId] }),
  }),
);

// ─── Grup / Kelas ─────────────────────────────────────────────────────────────
export const grup = pgTable('grup', {
  id: serial('id').primaryKey(),
  uid: varchar('uid', { length: 30 }).notNull().unique(), // cuid2
  namaGrup: varchar('nama_grup', { length: 50 }).notNull().unique(),
  nomorWa: varchar('nomor_wa', { length: 50 }), // Optional, format: 1234567890@g.us for WhatsApp Groups
  keterangan: text('keterangan'),
  ...timestamps,
});

// ─── Mata Kuliah ──────────────────────────────────────────────────────────────
export const mataKuliah = pgTable('mata_kuliah', {
  id: serial('id').primaryKey(),
  kode: varchar('kode', { length: 20 }).notNull().unique(),
  nama: varchar('nama', { length: 150 }).notNull(),
  sks: integer('sks').notNull().default(2),
  ...timestamps,
});

// ─── Jadwal Mata Kuliah ───────────────────────────────────────────────────────
export const jadwalMataKuliah = pgTable('jadwal_mata_kuliah', {
  id: serial('id').primaryKey(),
  mataKuliahId: integer('mata_kuliah_id')
    .notNull()
    .references(() => mataKuliah.id, { onDelete: 'cascade' }),
  dosenId: integer('dosen_id')
    .notNull()
    .references(() => dosen.id, { onDelete: 'restrict' }),
  hari: hariEnum('hari').notNull(),
  jamMulai: time('jam_mulai').notNull(),
  jamSelesai: time('jam_selesai').notNull(),
  ruangan: varchar('ruangan', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

// ─── Grup Jadwal (Pivot Table) ───────────────────────────────────────────────
export const grupJadwal = pgTable(
  'grup_jadwal',
  {
    grupId: integer('grup_id')
      .notNull()
      .references(() => grup.id, { onDelete: 'cascade' }),
    jadwalId: integer('jadwal_id')
      .notNull()
      .references(() => jadwalMataKuliah.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.grupId, t.jadwalId] }),
  }),
);

// ─── Reminder Log ─────────────────────────────────────────────────────────────
export const reminderLog = pgTable('reminder_log', {
  id: serial('id').primaryKey(),
  jadwalId: integer('jadwal_id')
    .notNull()
    .references(() => jadwalMataKuliah.id, { onDelete: 'cascade' }),
  targetType: targetTypeEnum('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  nomorWa: varchar('nomor_wa', { length: 50 }).notNull(),
  pesan: text('pesan').notNull(),
  status: reminderStatusEnum('status').notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  ...timestamps,
});

// ─── Berkas / File Manager ──────────────────────────────────────────────────
export const berkas = pgTable('berkas', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 150 }).notNull().unique(),
  url: text('url').notNull(),
  mimetype: varchar('mimetype', { length: 100 }).notNull(),
  keterangan: text('keterangan'),
  isPublic: boolean('is_public').default(false),
  uploadedBy: varchar('uploaded_by', { length: 50 }),
  ...timestamps,
});

// ─── Pengaturan ───────────────────────────────────────────────────────────────
export const pengaturan = pgTable('pengaturan', {
  id: serial('id').primaryKey(),
  grupId: integer('grup_id').references(() => grup.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 50 }).notNull(),
  value: text('value').notNull(),
  ...timestamps,
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const grupRelations = relations(grup, ({ many }) => ({
  mahasiswaGrups: many(mahasiswaGrup),
  dosenGrups: many(dosenGrup),
  grupJadwals: many(grupJadwal),
}));

export const mahasiswaRelations = relations(mahasiswa, ({ many }) => ({
  mahasiswaGrups: many(mahasiswaGrup),
}));

export const mahasiswaGrupRelations = relations(mahasiswaGrup, ({ one }) => ({
  mahasiswa: one(mahasiswa, {
    fields: [mahasiswaGrup.mahasiswaId],
    references: [mahasiswa.id],
  }),
  grup: one(grup, {
    fields: [mahasiswaGrup.grupId],
    references: [grup.id],
  }),
}));

export const dosenRelations = relations(dosen, ({ many }) => ({
  dosenGrups: many(dosenGrup),
  jadwals: many(jadwalMataKuliah),
}));

export const dosenGrupRelations = relations(dosenGrup, ({ one }) => ({
  dosen: one(dosen, {
    fields: [dosenGrup.dosenId],
    references: [dosen.id],
  }),
  grup: one(grup, {
    fields: [dosenGrup.grupId],
    references: [grup.id],
  }),
}));

export const mataKuliahRelations = relations(mataKuliah, ({ many }) => ({
  jadwals: many(jadwalMataKuliah),
}));

export const jadwalMataKuliahRelations = relations(
  jadwalMataKuliah,
  ({ one, many }) => ({
    mataKuliah: one(mataKuliah, {
      fields: [jadwalMataKuliah.mataKuliahId],
      references: [mataKuliah.id],
    }),
    dosen: one(dosen, {
      fields: [jadwalMataKuliah.dosenId],
      references: [dosen.id],
    }),
    grupJadwals: many(grupJadwal),
    reminderLogs: many(reminderLog),
  }),
);

export const reminderLogRelations = relations(reminderLog, ({ one }) => ({
  jadwal: one(jadwalMataKuliah, {
    fields: [reminderLog.jadwalId],
    references: [jadwalMataKuliah.id],
  }),
}));

export const grupJadwalRelations = relations(grupJadwal, ({ one }) => ({
  grup: one(grup, {
    fields: [grupJadwal.grupId],
    references: [grup.id],
  }),
  jadwal: one(jadwalMataKuliah, {
    fields: [grupJadwal.jadwalId],
    references: [jadwalMataKuliah.id],
  }),
}));

// ─── Schema Export ────────────────────────────────────────────────────────────
export const schema = {
  user,
  dosen,
  dosenGrup,
  mahasiswa,
  mahasiswaGrup,
  grup,
  mataKuliah,
  jadwalMataKuliah,
  grupJadwal,
  reminderLog,
  berkas,
  pengaturan,
  grupRelations,
  mahasiswaRelations,
  mahasiswaGrupRelations,
  dosenRelations,
  dosenGrupRelations,
  mataKuliahRelations,
  jadwalMataKuliahRelations,
  grupJadwalRelations,
  reminderLogRelations,
};

export type Schema = typeof schema;
