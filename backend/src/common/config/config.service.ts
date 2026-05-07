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
    const directUrl = this.config.get<string>('DATABASE_URL');
    if (directUrl) return directUrl;

    // Fallback: rakit dari POSTGRES_* variables (dipakai saat deploy via Docker Compose)
    const user = this.config.get<string>('POSTGRES_USER', 'postgres');
    const pass = this.config.get<string>('POSTGRES_PASSWORD', 'secret');
    const host = this.config.get<string>('POSTGRES_HOST', 'db');
    const port = this.config.get<string>('POSTGRES_PORT', '5432');
    const db = this.config.get<string>('POSTGRES_DB', 'remindme');
    return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
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

  get adminLogGroupId(): string | null {
    return this.config.get<string>('ADMIN_LOG_GROUP_ID') ?? null;
  }

  private devModeOverride: boolean | null = null;

  get isDevMode(): boolean {
    if (this.devModeOverride !== null) return this.devModeOverride;
    const val = this.config.get<string>('DEV_MODE', 'false');
    return val === 'true';
  }

  setRuntimeDevMode(val: boolean | null) {
    this.devModeOverride = val;
  }
}
