import { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as cookie from 'cookie';
import * as getHeaders from 'get-headers';
import { getClientIp } from 'request-ip';
import { readFileSync } from 'fs';

import { TokensService } from '../auth/tokens/tokens.service';

import { GeneratedTokens } from '../auth/types';

export class AuthenticatedWsAdapter extends WsAdapter {
	private readonly jwtService: JwtService;
	private readonly configService: ConfigService;
	private readonly tokensService: TokensService;
	constructor(private app: INestApplicationContext) {
		super(app);
		this.jwtService = this.app.get(JwtService);
		this.configService = this.app.get(ConfigService);
		this.tokensService = this.app.get(TokensService);
		this.jwtService.verifyAsync;
	}

	async validate(cookies: GeneratedTokens, ua: string, ip: string): Promise<boolean> {
		const valid_token = await this.jwtService
			.verifyAsync(cookies['access_token'], {
				algorithms: ['RS256'],
				secret: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'ascii'
				})
			})
			.catch((e) => {
				return null;
			});
		if (!valid_token) {
			return false;
		}
		return await this.tokensService
			.validate(valid_token.id, { access_token: cookies['access_token'] }, ua, ip)
			.catch((e) => false)
			.then((r) => true);
	}

	create(port: number, options?: any): any {
		options.verifyClient = async (ctx, allowFunction) => {
			const headers = getHeaders.array(ctx.req.rawHeaders);
			const cookies = cookie.parse(headers['Cookie'] as string);
			if (!cookies['access_token']) {
				return allowFunction(false, 401);
			}

			const ip = getClientIp(ctx.req);
			if (!(await this.validate(cookies as any, headers['user-agent'] as string, ip))) {
				return allowFunction(false, 401);
			}
			return allowFunction(true);
		};
		return super.create(port, options);
	}
}
