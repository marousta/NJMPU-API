import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { UsersModule } from '../users/users.module';
import { TokensModule } from './tokens/tokens.module';
import { PicturesModule } from '../pictures/pictures.module';

import { WsModule } from '../websockets/ws.module';

import { AuthController } from './controllers/auth.controller';
import { TwoFactorController } from './controllers/2fa.controller';
import { OAuth2Controller } from './controllers/oauth2.controller';
import { SessionsController } from './controllers/sessions.controller';

import { AuthService } from './services/auth.service';
import { TwoFactorService } from './services/2fa.service';
import { SessionsService } from './services/sessions.service';

import { LocalStrategy } from './strategies/local.strategy';
import { AccessStrategy } from './strategies/access.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { Intra42Strategy } from './strategies/42.strategy';
import { DiscordStrategy } from './strategies/discord.strategy';
import { TwoFactorStrategy } from './strategies/2fa.strategy';

import { UsersInfos } from '../users/entities/users.entity';
import { UsersTokens } from './tokens/tokens.entity';
import { UsersTwofactorReq } from './entities/2fa.entity';

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		PassportModule,
		TokensModule,
		JwtModule,
		HttpModule,
		PicturesModule,
		WsModule,
		TypeOrmModule.forFeature([UsersInfos, UsersTokens, UsersTwofactorReq])
	],
	providers: [
		AuthService,
		TwoFactorService,
		LocalStrategy,
		AccessStrategy,
		RefreshStrategy,
		Intra42Strategy,
		DiscordStrategy,
		TwoFactorStrategy,
		SessionsService
	],
	controllers: [AuthController, TwoFactorController, OAuth2Controller, SessionsController],
	exports: [AccessStrategy]
})
export class AuthModule {}
