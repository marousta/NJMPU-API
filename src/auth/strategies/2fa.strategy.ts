import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { readFileSync } from 'fs';

import { TwoFactorService } from '../services/2fa.service';

import { JwtData, Jwt2FA } from '../types';

@Injectable()
export class TwoFactorStrategy extends PassportStrategy(Strategy, 'twofactor') {
	private readonly logger = new Logger(TwoFactorStrategy.name);
	constructor(
		private readonly configService: ConfigService,
		private readonly twoFactorService: TwoFactorService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => {
					return req.cookies['twofactor_token'];
				}
			]),
			ignoreExpiration: false,
			secretOrKey: readFileSync(configService.get<string>('JWT_PRIVATE'), {
				encoding: 'utf8'
			}),
			algorithms: 'RS256',
			passReqToCallback: true
		});
	}

	// callback after JWT is validated
	async validate(req: Request, payload: Jwt2FA): Promise<JwtData> {
		const verif = await this.twoFactorService.verify.token({
			uuid: payload.uuid,
			token: req.cookies['twofactor_token']
		});
		if (!verif) {
			this.logger.verbose('Invalid 2FA JWT');
			throw new ForbiddenException();
		}

		return {
			token: payload,
			infos: verif
		};
	}
}
