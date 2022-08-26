import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { readFileSync } from 'fs';

import { TwoFactorService } from '../2fa/2fa.service';

@Injectable()
export class TwoFactorStrategy extends PassportStrategy(Strategy, 'twofactor') {
	constructor(private configService: ConfigService, private twoFactorService: TwoFactorService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['twofactor_token'];
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
	async validate(req: Request, payload: { uuid: string }) {
		if (
			await this.twoFactorService.verify.token({
				uuid: payload.uuid,
				token: req.cookies['twofactor_token']
			})
		) {
			return payload;
		} else {
			throw new ForbiddenException();
		}
	}
}
