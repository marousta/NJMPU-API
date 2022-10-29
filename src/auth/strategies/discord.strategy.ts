import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-discord';

import { DiscordUser } from '../types';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get<string>('DISCORD_ID'),
			clientSecret: configService.get<string>('DISCORD_SECRET'),
			callbackURL:
				configService.get<string>('PROTOCOL') +
				'://' +
				configService.get<string>('DOMAIN') +
				'/api/auth/oauth2/discord/callback',
			scope: ['identify', 'email']
		});
	}

	validate(access_token: string, refresh_token: string, user: DiscordUser): DiscordUser {
		return { interface: 'DiscordUser', ...user };
	}
}
