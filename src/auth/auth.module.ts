import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

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
import { RefreshStrategy } from './strategies/refresh.strategy';
import { TwoFactorStrategy } from './strategies/2fa.strategy';

import { UsersInfos } from '../users/entities/users.entity';
import { UsersTokens } from './tokens/tokens.entity';
import { UsersTwofactorReq } from './entities/2fa.entity';

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
		TypeOrmModule.forFeature([UsersInfos, UsersTokens, UsersTwofactorReq]),
		TokensModule,
		JwtModule,
		forwardRef(() => UsersModule),
		forwardRef(() => WsModule)
	],
	providers: [
		AuthService,
		TwoFactorService,
		AccessStrategy,
		RefreshStrategy,
		TwoFactorStrategy,
		SessionsService,
		...providers
	],
	controllers: [AuthController, TwoFactorController, SessionsController, ...controllers],
	exports: [AccessStrategy]
})
export class AuthModule {}
