import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-discord';

import { DiscordUser } from '../types';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
	constructor(private configService: ConfigService) {
		super({
			clientID: configService.get<string>('DISCORD_ID'),
			clientSecret: configService.get<string>('DISCORD_SECRET'),
			callbackURL: configService.get<string>('DISCORD_CALLBACK'),
			scope: ['identify', 'email']
		});
	}

	async validate(access_token: string, refresh_token: string, user: DiscordUser) {
		return { interface: 'discord', ...user };
	}
}
