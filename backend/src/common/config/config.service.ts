import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: NestConfigService) {}

  get appName(): string {
    return this.config.get<string>('APP_NAME', 'Reminder Me Bro');
  }

  get appVersion(): string {
    return this.config.get<string>('APP_VERSION', 'V.beta');
  }

  get port(): number {
    return this.config.get<number>('PORT', 3000);
  }

  get appUrl(): string {
    return this.config.get<string>('APP_URL', `http://localhost:${this.port}`);
  }

  get databaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
  }

  get redisName(): string {
    return this.config.get<string>('REDIS_NAME', '');
  }

  get redisPass(): string {
    return this.config.get<string>('REDIS_PASS', '');
  }

  get wahaUrl(): string {
    return this.config.getOrThrow<string>('WAHA_URL');
  }

  get swaggerUser(): string {
    return this.config.get<string>('SWAGGER_USER', 'admin');
  }

  get swaggerPass(): string {
    return this.config.get<string>('SWAGGER_PASS', 'admin123');
  }

  get wahaWebhookToken(): string {
    return this.config.get<string>('WAHA_WEBHOOK_TOKEN', '');
  }

  get wahaWebhookHmacKey(): string {
    return this.config.get<string>('WAHA_WEBHOOK_HMAC_KEY', '');
  }

  get wahaApiKey(): string {
    return this.config.get<string>('WAHA_API_KEY', '');
  }

  get wahaSessionName(): string {
    return this.config.get<string>('WAHA_SESSION_NAME', 'default');
  }

  get wahaCommandPrefix(): string {
    return this.config.get<string>('WAHA_COMMAND_PREFIX', '.');
  }

  get adminNumbers(): string[] {
    const val = this.config.get<string>('ADMIN_NUMBERS', '');
    return val ? val.split(',').map((n) => n.trim()) : [];
  }

  get isDevMode(): boolean {
    const val = this.config.get<string>('DEV_MODE', 'false');
    return val === 'true';
  }
}
