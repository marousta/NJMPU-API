import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { UsersModule } from '../users/users.module';
import { TokensModule } from './tokens/tokens.module';
import { PicturesModule } from '../pictures/pictures.module';
import { TwoFactorModule } from './2fa/2fa.module';

import { WsModule } from '../websockets/ws.module';

import { AuthController } from './auth.controller';
import { SessionsController } from './sessions/sessions.controller';

import { AuthService } from './auth.service';
import { TokensService } from './tokens/tokens.service';
import { TwoFactorService } from './2fa/2fa.service';
import { SessionsService } from './sessions/sessions.service';

import { LocalStrategy } from './strategies/local.strategy';
import { AccessStrategy } from './strategies/access.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { Intra42Strategy } from './strategies/42.strategy';
import { DiscordStrategy } from './strategies/discord.strategy';
import { TwoFactorStrategy } from './strategies/2fa.strategy';

import { UsersInfos } from '../users/entities/users.entity';
import { UsersTokens } from './tokens/tokens.entity';
import { UsersTwofactorReq } from './2fa/2fa.entity';

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		PassportModule,
		TokensModule,
		TwoFactorModule,
		JwtModule,
		HttpModule,
		PicturesModule,
		WsModule,
		TypeOrmModule.forFeature([UsersInfos, UsersTokens, UsersTwofactorReq])
	],
	providers: [
		AuthService,
		JwtService,
		TokensService,
		TwoFactorService,
		LocalStrategy,
		AccessStrategy,
		RefreshStrategy,
		Intra42Strategy,
		DiscordStrategy,
		TwoFactorStrategy,
		SessionsService
	],
	controllers: [AuthController, SessionsController],
	exports: [AccessStrategy]
})
export class AuthModule {}
