import { Module, forwardRef } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { WsModule } from '../websockets/ws.module';
import { PicturesModule } from '../pictures/pictures.module';

import { UsersController } from './users.controller';

import { UsersService } from './services/users.service';
import { TokensService } from '../auth/tokens/tokens.service';
import { NotifcationsService } from './services/notifications.service';

import { AccessStrategy } from '../auth/strategies/access.strategy';

import { UsersInfos } from './entities/users.entity';
import { UsersNotifications } from './entities/notifications.entity';
import { UsersTokens } from '../auth/tokens/tokens.entity';

@Module({
	imports: [
		JwtModule,
		ConfigModule,
		forwardRef(() => WsModule),
		forwardRef(() => PicturesModule),
		TypeOrmModule.forFeature([UsersInfos, UsersTokens, UsersNotifications]),
	],
	controllers: [UsersController],
	providers: [UsersService, NotifcationsService, ConfigService, AccessStrategy, TokensService],
	exports: [UsersService, NotifcationsService],
})
export class UsersModule {}
