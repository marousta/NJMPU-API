import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-42';

import { Intra42User } from '../types';

@Injectable()
export class Intra42Strategy extends PassportStrategy(Strategy, '42') {
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get<string>('INTRA42_ID'),
			clientSecret: configService.get<string>('INTRA42_SECRET'),
			callbackURL:
				configService.get<string>('PROTOCOL') +
				'://' +
				configService.get<string>('DOMAIN') +
				'/api/auth/oauth2/42/callback'
		});
	}

	validate(access_token: string, refresh_token: string, ret: any): Intra42User {
		const intra42User: Intra42User = ret._json;
		return { interface: 'Intra42User', ...intra42User };
	}
}
