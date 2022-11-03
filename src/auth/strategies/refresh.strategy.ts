import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { readFileSync } from 'fs';

import { TokensService } from '../tokens/tokens.service';

import { Jwt, JwtData } from '../types';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
	constructor(
		private readonly tokenService: TokensService,
		private readonly configService: ConfigService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['refresh_token'];
				}
			]),
			ignoreExpiration: false,
			secretOrKey: readFileSync(configService.get<string>('JWT_PUBLIC'), {
				encoding: 'utf8'
			}),
			algorithms: 'RS256',
			passReqToCallback: true
		});
	}

	// callback after JWT is validated
	async validate(req: Request, payload: Jwt): Promise<JwtData> {
		const user = await this.tokenService.validate(
			payload.tuuid,
			{ refresh_token: req.cookies['refresh_token'] },
			req.headers['user-agent'],
			req.clientIp
		);
		return {
			token: payload,
			infos: user
		};
	}
}
