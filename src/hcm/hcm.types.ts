export interface HcmBalanceDto {
  employeeId: string;
  locationId: string;
  leaveType: string;
  balanceDays: number;
}

export interface HcmDebitRequest {
  employeeId: string;
  locationId: string;
  leaveType: string;
  days: number;
  idempotencyKey: string;
}

export interface HcmCreditRequest extends HcmDebitRequest {}

export interface HcmWriteResult {
  transactionId: string;
  balanceDays: number;
}
