import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestNoteDto } from './dto/update-request-note.dto';
import { RequestStatus } from '../common/enums';

@Controller('api/requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateRequestDto,
    @Res() res: Response
  ) {
    const result = await this.requestsService.createRequest(user, dto);
    return res
      .status(result.code)
      .json({ requestId: result.requestId, status: result.status });
  }

  @Get()
  listRequests(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.requestsService.listRequests({ employeeId, status, from, to });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.requestsService.getById(id);
  }

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() manager: RequestUser,
    @Body() payload: UpdateRequestNoteDto
  ) {
    return this.requestsService.approveRequest(id, manager, payload.note);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() manager: RequestUser,
    @Body() payload: UpdateRequestNoteDto
  ) {
    return this.requestsService.rejectRequest(id, manager, payload.note);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.requestsService.cancelRequest(id, user);
  }
}
