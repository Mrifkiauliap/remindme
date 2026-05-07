import { AppConfigService } from '@/common/config/config.service';
import { Injectable, Logger } from '@nestjs/common';
import { WaSenderService } from '../../wa-sender/wa-sender.service';

@Injectable()
export class ProfileHandler {
  constructor(
    private readonly config: AppConfigService,
    private readonly waSender: WaSenderService,
  ) {}

  async handleDaftar(chatId: string, args: string[], reply_to?: string) {
    // Logic pendaftaran DM (Personal Mahasiswa/Dosen)
    await this.waSender.sendText({
      chatId,
      text: `[DUMMY] Berhasil menjalankan perintah *daftar* untuk personal.\nSegera hadir...`,
      reply_to,
    });
  }

  async handleMe(chatId: string, args: string[], reply_to?: string) {
    // TODO: Implementasi logika tampilkan profil sendiri
    await this.waSender.sendText({
      chatId,
      text: `[DUMMY] Profil Anda:\nNomor WA: ${chatId}\n(Segera hadir...)`,
      reply_to,
    });
  }
}
