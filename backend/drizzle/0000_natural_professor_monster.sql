CREATE TYPE "public"."hari" AS ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('mahasiswa', 'dosen', 'grup');--> statement-breakpoint
CREATE TABLE "berkas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(150) NOT NULL,
	"url" text NOT NULL,
	"mimetype" varchar(100) NOT NULL,
	"keterangan" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "berkas_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "dosen" (
	"id" serial PRIMARY KEY NOT NULL,
	"nip" varchar(30) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"nomor_wa" varchar(20) NOT NULL,
	"email" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dosen_nip_unique" UNIQUE("nip")
);
--> statement-breakpoint
CREATE TABLE "dosen_grup" (
	"dosen_id" integer NOT NULL,
	"grup_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dosen_grup_dosen_id_grup_id_pk" PRIMARY KEY("dosen_id","grup_id")
);
--> statement-breakpoint
CREATE TABLE "grup" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(30) NOT NULL,
	"nama_grup" varchar(50) NOT NULL,
	"nomor_wa" varchar(30),
	"keterangan" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grup_uid_unique" UNIQUE("uid"),
	CONSTRAINT "grup_nama_grup_unique" UNIQUE("nama_grup")
);
--> statement-breakpoint
CREATE TABLE "jadwal_mata_kuliah" (
	"id" serial PRIMARY KEY NOT NULL,
	"mata_kuliah_id" integer NOT NULL,
	"dosen_id" integer NOT NULL,
	"grup_id" integer NOT NULL,
	"hari" "hari" NOT NULL,
	"jam_mulai" time NOT NULL,
	"jam_selesai" time NOT NULL,
	"ruangan" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mahasiswa" (
	"id" serial PRIMARY KEY NOT NULL,
	"nim" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"nomor_wa" varchar(20) NOT NULL,
	"email" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mahasiswa_nim_unique" UNIQUE("nim")
);
--> statement-breakpoint
CREATE TABLE "mahasiswa_grup" (
	"mahasiswa_id" integer NOT NULL,
	"grup_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mahasiswa_grup_mahasiswa_id_grup_id_pk" PRIMARY KEY("mahasiswa_id","grup_id")
);
--> statement-breakpoint
CREATE TABLE "mata_kuliah" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode" varchar(20) NOT NULL,
	"nama" varchar(150) NOT NULL,
	"sks" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mata_kuliah_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"jadwal_id" integer NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" integer NOT NULL,
	"nomor_wa" varchar(20) NOT NULL,
	"pesan" text NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "dosen_grup" ADD CONSTRAINT "dosen_grup_dosen_id_dosen_id_fk" FOREIGN KEY ("dosen_id") REFERENCES "public"."dosen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosen_grup" ADD CONSTRAINT "dosen_grup_grup_id_grup_id_fk" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_mata_kuliah" ADD CONSTRAINT "jadwal_mata_kuliah_mata_kuliah_id_mata_kuliah_id_fk" FOREIGN KEY ("mata_kuliah_id") REFERENCES "public"."mata_kuliah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_mata_kuliah" ADD CONSTRAINT "jadwal_mata_kuliah_dosen_id_dosen_id_fk" FOREIGN KEY ("dosen_id") REFERENCES "public"."dosen"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_mata_kuliah" ADD CONSTRAINT "jadwal_mata_kuliah_grup_id_grup_id_fk" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mahasiswa_grup" ADD CONSTRAINT "mahasiswa_grup_mahasiswa_id_mahasiswa_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."mahasiswa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mahasiswa_grup" ADD CONSTRAINT "mahasiswa_grup_grup_id_grup_id_fk" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_jadwal_id_jadwal_mata_kuliah_id_fk" FOREIGN KEY ("jadwal_id") REFERENCES "public"."jadwal_mata_kuliah"("id") ON DELETE cascade ON UPDATE no action;