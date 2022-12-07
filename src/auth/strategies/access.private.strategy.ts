import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { readFileSync } from 'fs';

import { TokensService } from '../tokens/tokens.service';

import { Jwt, JwtData } from '../types';

@Injectable()
export class AccessPrivateStrategy extends PassportStrategy(Strategy, 'private') {
	constructor(
		private readonly configService: ConfigService,
		private readonly tokenService: TokensService,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['access_token'];
				},
			]),
			ignoreExpiration: false,
			secretOrKey: readFileSync(configService.get<string>('JWT_PUBLIC'), {
				encoding: 'utf8',
			}),
			algorithms: ['RS256'],
			passReqToCallback: true,
		});
	}

	// callback after JWT is validated
	async validate(req: Request, payload: Jwt): Promise<JwtData> {
		const user = await this.tokenService.validate(
			payload.tuuid,
			{ access_token: req.cookies['access_token'] },
			req.headers['user-agent'],
			req.clientIp,
		);
		if (!user) {
			throw new UnprocessableEntityException(
				'User is valid but validation process returned falsy, this should not happen',
			);
		}
		return {
			token: payload,
			infos: user,
		};
	}
}
