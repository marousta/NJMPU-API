import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

import { WsModule } from '../websockets/ws.module';

import { UsersController } from './users.controller';

import { UsersService } from './services/users.service';
import { TokensService } from '../auth/tokens/tokens.service';
import { NotifcationsService } from './services/notifications.service';

import { AccessStrategy } from '../auth/strategies/access.strategy';

import { UsersInfos } from './entities/users.entity';
import { UsersNotifications } from './entities/notifications.entity';
import { UsersTokens } from '../auth/tokens/tokens.entity';

@Module({
	imports: [TypeOrmModule.forFeature([UsersInfos, UsersTokens, UsersNotifications]), WsModule],
	controllers: [UsersController],
	providers: [
		UsersService,
		NotifcationsService,
		ConfigService,
		AccessStrategy,
		TokensService,
		JwtService
	],
	exports: [UsersService]
})
export class UsersModule {}
