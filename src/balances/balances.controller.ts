import {
  Controller,
  Get,
  Param,
  UseGuards
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/balances')
@UseGuards(JwtAuthGuard)
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get(':employeeId')
  getEmployeeBalances(@Param('employeeId') employeeId: string) {
    return this.balancesService.getEmployeeBalances(employeeId);
  }

  @Get(':employeeId/:locationId/:leaveType')
  getExactBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('leaveType') leaveType: string
  ) {
    return this.balancesService.getExactBalance(employeeId, locationId, leaveType, true);
  }
}
