import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { readFileSync } from 'fs';

import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class AccessStrategy extends PassportStrategy(Strategy, 'access') {
	constructor(
		private readonly configService: ConfigService,
		private readonly tokenService: TokensService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['access_token'];
				}
			]),
			ignoreExpiration: false,
			secretOrKey: readFileSync(configService.get<string>('JWT_PRIVATE'), {
				encoding: 'ascii'
			}),
			algorithms: 'RS256',
			passReqToCallback: true
		});
	}

	// callback after JWT is validated
	async validate(req: Request, payload: { id: number; exp: number }) {
		await this.tokenService.validate(
			payload.id,
			{ access_token: req.cookies['access_token'] },
			req.headers['user-agent'],
			req.clientIp
		);
		return payload;
	}
}
