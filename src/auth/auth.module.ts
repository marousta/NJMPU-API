import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { readFileSync } from 'fs';

import { UsersModule } from '../users/users.module';
import { TokensModule } from './tokens/tokens.module';

import { WsModule } from '../websockets/ws.module';

import { AuthController } from './controllers/auth.controller';
import { TwoFactorController } from './controllers/2fa.controller';
import { SessionsController } from './controllers/sessions.controller';

import { AuthService } from './services/auth.service';
import { TwoFactorService } from './services/2fa.service';
import { SessionsService } from './services/sessions.service';

import { AccessStrategy } from './strategies/access.strategy';
import { AccessPrivateStrategy } from './strategies/access.private.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { TwoFactorStrategy } from './strategies/2fa.strategy';

import { UsersInfos } from '../users/entities/users.entity';
import { UsersTokens } from './tokens/tokens.entity';

import { authMethods } from './authMethods';

const methods = authMethods();
const providers: Array<any> = methods[0];
const controllers: Array<any> = methods[1];
const modules: Array<any> = methods[2];

@Module({
	imports: [
		...modules,
		ConfigModule,
		PassportModule,
		HttpModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => {
				const options: JwtModuleOptions = {
					privateKey: readFileSync(configService.get<string>('JWT_PRIVATE'), {
						encoding: 'utf8',
					}),
					publicKey: readFileSync(configService.get<string>('JWT_PUBLIC'), {
						encoding: 'utf8',
					}),
					signOptions: {
						algorithm: 'RS256',
					},
				};
				return options;
			},
			inject: [ConfigService],
		}),
		TypeOrmModule.forFeature([UsersInfos, UsersTokens]),
		TokensModule,
		forwardRef(() => UsersModule),
		forwardRef(() => WsModule),
	],
	providers: [
		AuthService,
		TwoFactorService,
		AccessStrategy,
		AccessPrivateStrategy,
		RefreshStrategy,
		TwoFactorStrategy,
		SessionsService,
		...providers,
	],
	controllers: [AuthController, TwoFactorController, SessionsController, ...controllers],
	exports: [AccessStrategy],
})
export class AuthModule {}
