CREATE TABLE "grup_jadwal" (
	"grup_id" integer NOT NULL,
	"jadwal_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grup_jadwal_grup_id_jadwal_id_pk" PRIMARY KEY("grup_id","jadwal_id")
);
--> statement-breakpoint
CREATE TABLE "pengaturan" (
	"id" serial PRIMARY KEY NOT NULL,
	"grup_id" integer,
	"key" varchar(50) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jadwal_mata_kuliah" DROP CONSTRAINT "jadwal_mata_kuliah_grup_id_grup_id_fk";
--> statement-breakpoint
ALTER TABLE "dosen" ALTER COLUMN "nomor_wa" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "grup" ALTER COLUMN "nomor_wa" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "mahasiswa" ALTER COLUMN "nomor_wa" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "reminder_log" ALTER COLUMN "nomor_wa" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "berkas" ADD COLUMN "uploaded_by" varchar(50);--> statement-breakpoint
ALTER TABLE "grup_jadwal" ADD CONSTRAINT "grup_jadwal_grup_id_grup_id_fk" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grup_jadwal" ADD CONSTRAINT "grup_jadwal_jadwal_id_jadwal_mata_kuliah_id_fk" FOREIGN KEY ("jadwal_id") REFERENCES "public"."jadwal_mata_kuliah"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengaturan" ADD CONSTRAINT "pengaturan_grup_id_grup_id_fk" FOREIGN KEY ("grup_id") REFERENCES "public"."grup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal_mata_kuliah" DROP COLUMN "grup_id";