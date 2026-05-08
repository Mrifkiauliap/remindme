import { Public } from '@/common/decorators/public.decorator';
import { DrizzleService } from '@/db/drizzle.service';
import * as schema from '@/db/schema/schema';
import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('public/uploads')
export class BerkasController {
  constructor(private readonly drizzle: DrizzleService) {}

  @Public()
  @Get('*path')
  async getFile(@Param('path') fullPath: string, @Res() res: Response) {
    console.log(`[BerkasController] Request Path: ${fullPath}`);

    if (!fullPath) throw new NotFoundException('Path tidak ditemukan');

    const parts = fullPath.split('/');
    const filename = parts.pop();
    const folder = parts.join('/');

    if (!filename) throw new NotFoundException('Nama file tidak valid');

    return this.serveFile(folder, filename, res);
  }

  private async serveFile(folder: string, filename: string, res: Response) {
    // Ambil nama tanpa ekstensi
    const nameOnly = filename.split('.').slice(0, -1).join('.');
    console.log(`[BerkasController] DB Search: ${nameOnly}`);

    // Cari di DB
    const [berkas] = await this.drizzle.db
      .select()
      .from(schema.berkas)
      .where(eq(schema.berkas.nama, nameOnly))
      .limit(1);

    if (!berkas) {
      throw new NotFoundException('Berkas tidak ditemukan di database.');
    }

    // Cek apakah publik
    if (!berkas.isPublic) {
      throw new ForbiddenException('Berkas ini bersifat private.');
    }

    // Cari file fisik
    const filePath = path.join(
      process.cwd(),
      'public',
      'uploads',
      folder,
      filename,
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File fisik tidak ditemukan.');
    }

    return res.sendFile(filePath);
  }
}
