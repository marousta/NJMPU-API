import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthEmailController } from './controllers/methods/auth.email.controller';
import { OAuth2Intra42Controller } from './controllers/methods/oauth2.42.controller';
import { OAuth2DiscordController } from './controllers/methods/oauth2.discord.controller';
import { OAuth2TwitterController } from './controllers/methods/oauth2.twitter.controller';

import { Intra42Strategy } from './strategies/42.strategy';
import { DiscordStrategy } from './strategies/discord.strategy';
import { EmailStrategy } from './strategies/email.strategy';
import { TwitterStrategy } from './strategies/twitter.strategy';

import { colors } from '../types';

import { isEmpty } from '../utils';

export function authMethods(config: ConfigService = undefined) {
	if (!config) {
		ConfigModule.forRoot({
			isGlobal: true
		});
		config = new ConfigService();
	}

	const providers: Array<any> = [];
	const controllers: Array<any> = [];

	if (config.get<boolean>('EMAIL_LOGIN')) {
		providers.push(EmailStrategy);
		controllers.push(AuthEmailController);
	}

	if (
		!isEmpty(config.get<string>('INTRA42_ID')) &&
		!isEmpty(config.get<string>('INTRA42_SECRET'))
	) {
		providers.push(Intra42Strategy);
		controllers.push(OAuth2Intra42Controller);
	}

	if (
		!isEmpty(config.get<string>('DISCORD_ID')) &&
		!isEmpty(config.get<string>('DISCORD_SECRET'))
	) {
		providers.push(DiscordStrategy);
		controllers.push(OAuth2DiscordController);
	}

	if (
		!isEmpty(config.get<string>('TWITTER_ID')) &&
		!isEmpty(config.get<string>('TWITTER_SECRET'))
	) {
		providers.push(TwitterStrategy);
		controllers.push(OAuth2TwitterController);
	}

	if (!providers.length || !controllers.length) {
		console.error(colors.red + 'No authentification method available.' + colors.end);
		process.exit(1);
	}

	return [providers, controllers];
}
