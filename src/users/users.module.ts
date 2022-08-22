import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersInfos } from './users.entity';
import { accessStrategy } from '../auth/strategies/access.strategy';

@Module({
	imports: [TypeOrmModule.forFeature([UsersInfos])],
	controllers: [UsersController],
	providers: [UsersService, accessStrategy],
	exports: [UsersService]
})
export class UsersModule {}
