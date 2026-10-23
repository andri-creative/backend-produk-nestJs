import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { AuthAccount } from './entities/auth-account.entity';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuthModule,
    SequelizeModule.forFeature([User, AuthAccount, UserProfile]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
