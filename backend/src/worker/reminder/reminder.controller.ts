import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ReminderService } from './reminder.service';

@ApiTags('Worker - Reminder')
@ApiSecurity('api-key')
@Controller('worker/reminder')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Lihat semua log reminder' })
  findAll() {
    return this.reminderService.findAll();
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Lihat log reminder berdasarkan ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reminderService.findOne(id);
  }
}
