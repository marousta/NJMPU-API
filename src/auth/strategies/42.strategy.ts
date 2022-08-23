import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-42';

import { Intra42User } from '../types';

@Injectable()
export class intra42Strategy extends PassportStrategy(Strategy, '42') {
	constructor(private configService: ConfigService) {
		super({
			clientID: configService.get<string>('INTRA42_ID'),
			clientSecret: configService.get<string>('INTRA42_SECRET'),
			callbackURL: configService.get<string>('INTRA42_CALLBACK')
		});
	}

	async validate(access_token: string, refresh_token: string, user: Intra42User) {
		return user;
	}
}
