import { Module } from '@nestjs/common';
import { HelpersController } from './helpers.controller';
import { HelpersService } from './helpers.service';
import { PostgresModule } from '../../core/postgres/postgres.module';

@Module({
  imports: [PostgresModule],
  controllers: [HelpersController],
  providers: [HelpersService],
})
export class HelpersModule {}
