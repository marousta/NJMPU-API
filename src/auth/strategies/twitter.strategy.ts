import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter';

import { TwitterUser } from '../types';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
	constructor(private readonly configService: ConfigService) {
		super({
			consumerKey: configService.get<string>('TWITTER_ID'),
			consumerSecret: configService.get<string>('TWITTER_SECRET'),
			callbackURL:
				configService.get<string>('PROTOCOL') +
				'://' +
				configService.get<string>('DOMAIN') +
				'/api/auth/oauth2/twitter/callback',
			userProfileURL:
				'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
		});
	}

	validate(access_token: string, refresh_token: string, twitterUser: TwitterUser): TwitterUser {
		return { interface: 'TwitterUser', ...twitterUser };
	}
}
