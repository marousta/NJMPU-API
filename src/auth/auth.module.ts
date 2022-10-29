import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { AuthSignInController } from './controllers/methods/auth.signin.controller';
import { OAuth2Intra42Controller } from './controllers/methods/oauth2.42.controller';
import { OAuth2DiscordController } from './controllers/methods/oauth2.discord.controller';

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

import { isEmpty } from '../utils';
import { colors } from 'src/types';

const providers: Array<any> = [];
const controllers: Array<any> = [];

ConfigModule.forRoot({
	isGlobal: true
});
const config = new ConfigService();

if (config.get<boolean>('EMAIL_LOGIN')) {
	providers.push(LocalStrategy);
	controllers.push(AuthSignInController);
}

// prettier-ignore
if (!isEmpty(config.get<string>('INTRA42_ID'))
&& !isEmpty(config.get<string>('INTRA42_SECRET'))) {
	providers.push(Intra42Strategy);
	controllers.push(OAuth2Intra42Controller);
}

// prettier-ignore
if (!isEmpty(config.get<string>('INTRA42_ID'))
&& !isEmpty(config.get<string>('INTRA42_SECRET'))) {
	providers.push(Intra42Strategy);
	controllers.push(OAuth2Intra42Controller);
}

// prettier-ignore
if (!isEmpty(config.get<string>('DISCORD_ID'))
&& !isEmpty(config.get<string>('DISCORD_SECRET'))) {
	providers.push(DiscordStrategy);
	controllers.push(OAuth2DiscordController);
}

if (!providers.length || !controllers.length) {
	console.error(colors.red + 'No authentification method available.' + colors.end);
	process.exit(1);
}

@Module({
	imports: [
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
