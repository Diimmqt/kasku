import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar notifikasi pengguna dan jumlah belum dibaca' })
  listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.listForUser(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Jumlah notifikasi yang belum dibaca' })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Tandai satu notifikasi sudah dibaca' })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.id, notificationId);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Tandai seluruh notifikasi sebagai sudah dibaca' })
  markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.notificationsService.markAllAsRead(user.id, workspaceId);
  }

  @Post('check-reminders')
  @ApiOperation({ summary: 'Periksa pengingat utang/piutang jatuh tempo sekarang' })
  checkReminders() {
    return this.notificationsService.checkDueDebtsAndNotify();
  }
}

