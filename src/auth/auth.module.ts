import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { accessStrategy } from './strategies/access.strategy';
import { refreshStrategy } from './strategies/refresh.strategy';
import { UsersInfos } from '../users/users.entity';
import { TokensService } from './tokens/tokens.service';
import { TokensModule } from './tokens/tokens.module';
import { UsersTokens } from './tokens/tokens.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		PassportModule,
		TokensModule,
		JwtModule,
		TypeOrmModule.forFeature([UsersInfos, UsersTokens])
	],
	providers: [AuthService, JwtService, TokensService, LocalStrategy, accessStrategy, refreshStrategy],
	controllers: [AuthController],
	exports: [AuthService]
})
export class AuthModule {}
