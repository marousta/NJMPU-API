import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class refreshStrategy extends PassportStrategy(Strategy, 'refresh') {
	constructor(private tokenService: TokensService, private configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['refresh_token'];
				}
			]),
			ignoreExpiration: false,
			secretOrKey: readFileSync(configService.get<string>('JWT_PRIVATE'), { encoding: 'ascii' }),
			algorithms: 'RS256',
			passReqToCallback: true
		});
	}

	// callback after JWT is validated
	async validate(req: Request, payload: { id: number }) {
		await this.tokenService.validate(
			payload.id,
			{ refresh_token: req.cookies['refresh_token'] },
			req.headers['user-agent'],
			req.clientIp
		);
		return payload;
	}
}
