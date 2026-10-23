import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../core/auth/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import type { JwtPayload } from '../../core/auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  AccountView,
  ProfileView,
  UserDetail,
  UsersService,
} from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload): Promise<UserDetail> {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me/profile')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileView> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('me/accounts')
  async listAccounts(@CurrentUser() user: JwtPayload): Promise<AccountView[]> {
    return this.usersService.listAccounts(user.sub);
  }
}
