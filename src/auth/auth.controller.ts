import { Body, Controller, Get, Headers, HttpCode, Post, Request, Response, UseGuards } from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { UAParser } from 'ua-parser-js';

import { AuthService } from './auth.service';
import { TokensService } from './tokens/tokens.service';

import { SigninProperty } from './properties/signin.property';
import { SignupProperty } from './properties/signup.property';

import { Intra42User, UserFingerprint } from './types';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService, private tokensService: TokensService) {}

	private getPlatform(headers: Headers) {
		const ua = new UAParser(headers['user-agent']);
		const browser = ua.getBrowser().name;
		const os = ua.getOS().name;
		return `${browser} ${os}`;
	}

	private getFingerprint(req: Req, headers: Headers): UserFingerprint {
		return {
			platform: this.getPlatform(headers),
			ua: headers['user-agent'],
			ip: req.clientIp
		};
	}

	@UseGuards(AuthGuard('local'))
	@ApiBody({ type: SigninProperty })
	@HttpCode(200)
	@Post('signin')
	async function(@Request() req: Req, @Headers() headers: Headers, @Response({ passthrough: true }) res: Res) {
		const fingerprint = this.getFingerprint(req, headers);

		const { access_token, refresh_token } = await this.authService.login.byPassword(req.user as any, fingerprint);

		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
	}

	@ApiBody({ type: SignupProperty })
	@HttpCode(201)
	@Post('signup')
	async registerLocal(@Body() params: SignupProperty) {
		await this.authService.user.create(params);
	}

	@UseGuards(AuthGuard('refresh'))
	@HttpCode(200)
	@Post('logout')
	async logoutLocal(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		this.authService.user.disconnect(req.user);
		this.authService.cookie.delete(res, 'access_token');
		this.authService.cookie.delete(res, 'refresh_token');
	}

	@UseGuards(AuthGuard('refresh'))
	@HttpCode(200)
	@Get('whoami')
	async whoami(@Request() req: Req) {
		return await this.tokensService.user((req.user as any).id);
	}

	@UseGuards(AuthGuard('refresh'))
	@Post('refresh')
	async refresh(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const { access_token, refresh_token } = await this.tokensService.update((req.user as any).id);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
	}

	@UseGuards(AuthGuard('42'))
	@Get('/oauth2/42')
	intra42Auth() {}

	@ApiExcludeEndpoint()
	@UseGuards(AuthGuard('42'))
	@Get('/oauth2/42/callback')
	async intra42AuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user: Intra42User = req.user as any;
		const fingerprint = this.getFingerprint(req, headers);

		let tokens = await this.authService.login.byAPI(user, fingerprint);
		if (!tokens) {
			await this.authService.user.createFromAPI.intra42(user);
			tokens = await this.authService.login.byAPI(user, fingerprint);
		}
		const { access_token, refresh_token } = tokens;
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
		res.redirect('/api');
	}
}
