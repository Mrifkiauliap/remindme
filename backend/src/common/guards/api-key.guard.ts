import { DrizzleService } from '@/db/drizzle.service';
import { user } from '@/db/schema/schema';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly drizzle: DrizzleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key tidak ditemukan');
    }

    const [found] = await this.drizzle.db
      .select()
      .from(user)
      .where(eq(user.apiKey, apiKey))
      .limit(1);

    if (!found || !found.isActive) {
      throw new UnauthorizedException('API Key tidak valid atau tidak aktif');
    }

    request.user = found;
    return true;
  }
}
