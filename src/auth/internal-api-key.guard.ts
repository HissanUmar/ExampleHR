import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-internal-api-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    const expected = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expected || provided !== expected) {
      throw new ForbiddenException('INTERNAL_API_KEY_INVALID');
    }

    return true;
  }
}
