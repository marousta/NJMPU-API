import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { TokensModule } from './tokens/tokens.module';

import { AuthController } from './auth.controller';

import { AuthService } from './auth.service';
import { TokensService } from './tokens/tokens.service';

import { LocalStrategy } from './strategies/local.strategy';
import { AccessStrategy } from './strategies/access.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { Intra42Strategy } from './strategies/42.strategy';

import { UsersInfos } from '../users/users.entity';
import { UsersTokens } from './tokens/tokens.entity';
import { PictureModule } from '../picture/picture.module';
import { PictureService } from '../picture/picture.service';
import { HttpModule } from '@nestjs/axios';
import { DiscordStrategy } from './strategies/discord.strategy';

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		PassportModule,
		TokensModule,
		JwtModule,
		HttpModule,
		PictureModule,
		TypeOrmModule.forFeature([UsersInfos, UsersTokens])
	],
	providers: [
		AuthService,
		JwtService,
		TokensService,
		PictureService,
		LocalStrategy,
		AccessStrategy,
		RefreshStrategy,
		Intra42Strategy,
		DiscordStrategy
	],
	controllers: [AuthController],
	exports: [AuthService]
})
export class AuthModule {}
