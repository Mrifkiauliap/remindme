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

    // 3. Load Data Privacy
    let dataDosen: any[] = [];
    let dataMk: any[] = [];
    let dataJadwal: any[] = [];
    let dataGrup: any[] = [];
    try {
      // Menggunakan require agar tidak menyebabkan error TypeScript di CI/CD
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nowSeed = require('./now.seed');
      dataDosen = nowSeed.seedDosen || [];
      dataMk = nowSeed.seedMk || [];
      dataJadwal = nowSeed.seedJadwal || [];
      dataGrup = nowSeed.seedGrup || [];
      console.log(
        `📦 Loaded ${dataDosen.length} dosen, ${dataMk.length} MK, ${dataJadwal.length} jadwal, ${dataGrup.length} grup dari now.seed.ts`,
      );
    } catch (e) {
      console.log(
        '⚠️ now.seed.ts tidak ditemukan. Melewati seeding data privacy.',
      );
    }

    // 4. Dosen
    console.log('Seeding Dosen...');
    const mapDosen = new Map<string, number>(); // Nama -> ID Dosen
    if (dataDosen.length > 0) {
      const insertedDosen = await db
        .insert(schema.dosen)
        .values(dataDosen)
        .returning();
      insertedDosen.forEach((d) => mapDosen.set(d.nama, d.id));
    }

    // 5. Grup
    console.log('Seeding Grup...');
    const grupToInsert =
      dataGrup.length > 0
        ? dataGrup
        : [
            {
              uid: 'ti22a',
              namaGrup: 'TI-22-A',
              keterangan: 'Dummy Group A',
            },
          ];

    const insertedGrup = await db
      .insert(schema.grup)
      .values(grupToInsert)
      .returning();
    const mainGrup = insertedGrup[0];

    // 6. Mata Kuliah
    console.log('Seeding Mata Kuliah...');
    const mapMk = new Map<string, number>(); // Kode MK -> ID MK
    if (dataMk.length > 0) {
      const insertedMk = await db
        .insert(schema.mataKuliah)
        .values(dataMk)
        .returning();
      insertedMk.forEach((m) => mapMk.set(m.kode, m.id));
    }

    // 7. Jadwal
    console.log('Seeding Jadwal...');
    if (dataJadwal.length > 0 && mapMk.size > 0 && mapDosen.size > 0) {
      const jadwalToInsert = dataJadwal.map((j) => {
        const mataKuliahId = mapMk.get(j.mkKode);
        const dosenId = mapDosen.get(j.dosenNama);
        if (!mataKuliahId || !dosenId) {
          throw new Error(
            `Data relasi tidak ditemukan untuk jadwal MK ${j.mkKode} dosen ${j.dosenNama}`,
          );
        }
        return {
          mataKuliahId,
          dosenId,
          hari: j.hari,
          jamMulai: j.jamMulai,
          jamSelesai: j.jamSelesai,
          ruangan: j.ruangan,
        };
      });
      const insertedJadwal = await db
        .insert(schema.jadwalMataKuliah)
        .values(jadwalToInsert)
        .returning();

      // 8. Tautkan semua jadwal ke semua grup yang di-seed
      console.log('Linking all schedules to all seeded groups...');
      if (insertedJadwal.length > 0 && insertedGrup.length > 0) {
        const pivotValues: any[] = [];
        for (const g of insertedGrup) {
          for (const j of insertedJadwal) {
            pivotValues.push({
              grupId: g.id,
              jadwalId: j.id,
            });
          }
        }
        await db.insert(schema.grupJadwal).values(pivotValues);
      }
    }

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();
