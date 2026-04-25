import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  HcmBalanceDto,
  HcmCreditRequest,
  HcmDebitRequest,
  HcmWriteResult
} from './hcm.types';

@Injectable()
export class HcmAdapter {
  private readonly logger = new Logger(HcmAdapter.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService
  ) {}

  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string
  ): Promise<HcmBalanceDto> {
    try {
      const response = await firstValueFrom(
        this.http.get<HcmBalanceDto>(
          `${this.baseUrl()}/balance/${employeeId}/${locationId}/${leaveType}`,
          { headers: this.headers(), timeout: this.timeoutMs() }
        )
      );
      return response.data;
    } catch (error) {
      throw this.normalizeError(error, 'HCM_BALANCE_FETCH_FAILED');
    }
  }

  async debit(payload: HcmDebitRequest): Promise<HcmWriteResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<HcmWriteResult>(`${this.baseUrl()}/debit`, payload, {
          headers: this.headers(),
          timeout: this.timeoutMs()
        })
      );
      return response.data;
    } catch (error) {
      throw this.normalizeError(error, 'HCM_DEBIT_FAILED');
    }
  }

  async credit(payload: HcmCreditRequest): Promise<HcmWriteResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<HcmWriteResult>(`${this.baseUrl()}/credit`, payload, {
          headers: this.headers(),
          timeout: this.timeoutMs()
        })
      );
      return response.data;
    } catch (error) {
      throw this.normalizeError(error, 'HCM_CREDIT_FAILED');
    }
  }

  private baseUrl(): string {
    return this.configService.get<string>('hcm.baseUrl', 'http://localhost:4100/hcm');
  }

  private timeoutMs(): number {
    return this.configService.get<number>('hcm.timeoutMs', 5000);
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.configService.get<string>('hcm.apiKey', 'replace-me')
    };
  }

  private normalizeError(error: unknown, code: string): Error {
    const axiosError = error as {
      code?: string;
      response?: { status?: number; data?: unknown };
      message?: string;
    };

    if (axiosError.response?.status && axiosError.response.status < 500) {
      throw new ConflictException({
        error: 'HCM_REJECTED',
        code,
        detail: axiosError.response.data ?? axiosError.message
      });
    }

    this.logger.warn(`${code}: ${axiosError.message ?? 'Unknown HCM error'}`);
    return new ServiceUnavailableException({
      error: 'HCM_UNAVAILABLE',
      code,
      detail: axiosError.message ?? 'HCM is temporarily unavailable'
    });
  }
}
