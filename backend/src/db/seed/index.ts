import { createId } from '@paralleldrive/cuid2';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema/schema';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool, { schema });

async function seed() {
  console.log('🚀 Starting database seeding...');

  try {
    // 1. Clean Up
    console.log('🧹 Cleaning up existing data...');
    await db.delete(schema.reminderLog);
    await db.delete(schema.jadwalMataKuliah);
    await db.delete(schema.mahasiswaGrup);
    await db.delete(schema.dosenGrup);
    await db.delete(schema.mahasiswa);
    await db.delete(schema.grup);
    await db.delete(schema.dosen);
    await db.delete(schema.mataKuliah);
    await db.delete(schema.user);

    // 2. User Admin
    console.log('👤 Seeding Admin User...');
    await db.insert(schema.user).values({
      name: 'Super Admin',
      apiKey: 'admin-secret-key-123',
      isActive: true,
    });

    // 3. Dosen
    console.log('👨‍🏫 Seeding Dosen...');
    const [dosen1, dosen2, dosen3] = await db
      .insert(schema.dosen)
      .values([
        {
          nip: '198001012005011001',
          nama: 'Dr. Ir. Budiarto, M.T.',
          nomorWa: '6281234567890',
          email: 'budiarto@univ.ac.id',
        },
        {
          nip: '198505202010122002',
          nama: 'Siti Aminah, S.Kom., M.Cs.',
          nomorWa: '6289876543210',
          email: 'siti@univ.ac.id',
        },
        {
          nip: '199012312020011005',
          nama: 'Eko Prasetyo, M.T.',
          nomorWa: '6281122334455',
          email: 'eko@univ.ac.id',
        },
      ])
      .returning();

    // 4. Grup
    console.log('👥 Seeding Grup...');
    const [grupA, grupB] = await db
      .insert(schema.grup)
      .values([
        {
          uid: createId(),
          namaGrup: 'TI-22-A',
          keterangan: 'Teknik Informatika 2022 Kelas A',
        },
        {
          uid: createId(),
          namaGrup: 'SI-22-B',
          keterangan: 'Sistem Informasi 2022 Kelas B',
        },
      ])
      .returning();

    // 5. Mata Kuliah
    console.log('📚 Seeding Mata Kuliah...');
    const [mkWeb, mkStruct, mkProject] = await db
      .insert(schema.mataKuliah)
      .values([
        {
          kode: 'IF101',
          nama: 'Pemrograman Web',
          sks: 3,
        },
        {
          kode: 'IF102',
          nama: 'Struktur Data',
          sks: 4,
        },
        {
          kode: 'SI201',
          nama: 'Manajemen Proyek TI',
          sks: 2,
        },
      ])
      .returning();

    // 6. Jadwal
    console.log('📅 Seeding Jadwal...');
    await db.insert(schema.jadwalMataKuliah).values([
      {
        mataKuliahId: mkWeb.id,
        dosenId: dosen2.id,
        grupId: grupA.id,
        hari: 'Senin',
        jamMulai: '08:00:00',
        jamSelesai: '10:30:00',
        ruangan: 'Lab Terpadu 1',
      },
      {
        mataKuliahId: mkStruct.id,
        dosenId: dosen1.id,
        grupId: grupA.id,
        hari: 'Selasa',
        jamMulai: '13:00:00',
        jamSelesai: '15:30:00',
        ruangan: 'Gedung C 302',
      },
      {
        mataKuliahId: mkProject.id,
        dosenId: dosen3.id,
        grupId: grupB.id,
        hari: 'Rabu',
        jamMulai: '10:00:00',
        jamSelesai: '12:00:00',
        ruangan: 'Gedung B 101',
      },
    ]);

    // 7. Mahasiswa (Ngetes .me)
    console.log('🎓 Seeding Mahasiswa...');
    const [mhs1, mhs2] = await db
      .insert(schema.mahasiswa)
      .values([
        {
          nim: '230504089',
          nama: 'M Rifki Aulia P',
          nomorWa: '247622363250777@lid', // Nomor testing lu
        },
        {
          nim: '2200018999',
          nama: 'Dummy Student',
          nomorWa: '62895346200506',
        },
      ])
      .returning();

    // 8. Mahasiswa Grup & Dosen Grup
    console.log('🔗 Seeding Relasi Grup...');
    await db.insert(schema.mahasiswaGrup).values([
      {
        mahasiswaId: mhs1.id,
        grupId: grupA.id,
      },
      {
        mahasiswaId: mhs2.id,
        grupId: grupB.id,
      },
    ]);

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();
