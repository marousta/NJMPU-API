import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	Post,
	Request,
	Response,
	UseGuards,
	UnauthorizedException,
	HttpException
} from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { TokensService } from './tokens/tokens.service';
import { TwoFactorService } from './2fa/2fa.service';

import { Intra42AuthGuard } from './guards/42.guard';
import { DiscordAuthGuard } from './guards/discord.guard';
import { TwoFactorAuthGuard } from './guards/2fa.guard';

import { SigninProperty } from './properties/signin.property';
import { SignupProperty } from './properties/signup.property';
import { TwoFactorProperty } from './properties/2fa.property';

import { Intra42User, DiscordUser, JwtPayload } from './types';
import { getFingerprint } from '../utils';
import { AccessAuthGuard } from './guards/access.guard';
import { RefreshAuthGuard } from './guards/refresh.guard';
import { LocalAuthGuard } from './guards/local.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly tokensService: TokensService,
		private readonly twoFactorService: TwoFactorService
	) {}

	/**
	 * Sign in
	 */
	@UseGuards(LocalAuthGuard)
	@ApiBody({ type: SigninProperty })
	@HttpCode(200)
	@Post('signin')
	async function(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user = req.user as JwtPayload;
		const fingerprint = getFingerprint(req, headers);

		const ret = await this.authService.login.byPassword(user, fingerprint);

		if (ret.interface === 'GeneratedTokens') {
			const { access_token, refresh_token } = ret;
			this.authService.cookie.create(res, { access_token });
			this.authService.cookie.create(res, { refresh_token });
		} else if (ret.interface === 'TwoFactorRequest') {
			this.authService.cookie.create(res, { twofactor_token: ret.token });
			res.sendStatus(202);
		}
	}

	/**
	 * Sign up
	 */
	@ApiBody({ type: SignupProperty })
	@HttpCode(201)
	@Post('signup')
	async registerLocal(@Body() params: SignupProperty) {
		await this.authService.user.create(params);
	}

	/**
	 * Logout
	 */
	@UseGuards(RefreshAuthGuard)
	@HttpCode(200)
	@Post('logout')
	async logoutLocal(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		this.authService.user.disconnect(req.user);
		this.authService.cookie.delete(res, 'access_token');
		this.authService.cookie.delete(res, 'refresh_token');
	}

	/**
	 * Refresh tokens
	 */
	@UseGuards(RefreshAuthGuard)
	@Post('refresh')
	async refresh(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const { access_token, refresh_token } = await this.tokensService.update(
			(req.user as any).id
		);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
	}

	/**
	 * API
	 * 42
	 */
	@UseGuards(Intra42AuthGuard)
	@Get('/oauth2/42')
	intra42Auth() {}

	@ApiExcludeEndpoint()
	@UseGuards(Intra42AuthGuard)
	@Get('/oauth2/42/callback')
	async intra42AuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user: Intra42User = req.user as any;
		await this.authService.APIHandler(user, { req, headers, res });
	}

	/**
	 * API
	 * Discord
	 */
	@UseGuards(DiscordAuthGuard)
	@Get('/oauth2/discord')
	discordAuth() {}

	@ApiExcludeEndpoint()
	@UseGuards(DiscordAuthGuard)
	@Get('/oauth2/discord/callback')
	async discordAuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user: DiscordUser = req.user as any;
		await this.authService.APIHandler(user, { req, headers, res });
	}

	/**
	 * 2FA
	 */
	@UseGuards(RefreshAuthGuard)
	@HttpCode(202)
	@Get('/2fa')
	async twoFactorCreator(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const payload = req.user as JwtPayload;
		const request = await this.authService.twoFactor.demand(payload);
		this.authService.cookie.create(res, { twofactor_token: request.token });
		return request.image;
	}

	@UseGuards(AccessAuthGuard, TwoFactorAuthGuard)
	@ApiBody({ type: TwoFactorProperty })
	@HttpCode(200)
	@Post('/2fa')
	async twoFactorAuth(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const uuid = (req.user as any).uuid;
		const body = req.body as any;
		const code = body.code ? body.code : '';
		if (await this.twoFactorService.verify.code(uuid, code)) {
			const fingerprint = getFingerprint(req, headers);
			const tokens = await this.authService.twoFactor.login(uuid, fingerprint);
			const { access_token, refresh_token } = tokens;
			this.authService.cookie.delete(res, 'twofactor_token');
			this.authService.cookie.create(res, { access_token });
			this.authService.cookie.create(res, { refresh_token });
		} else {
			throw new HttpException('Code is invalid', 417);
		}
	}

	/**
	 * Front helper
	 */
	@UseGuards(AuthGuard('access'))
	@HttpCode(200)
	@Get('whoami')
	async whoami(@Request() req: Req) {
		const user = req.user as any;
		return await this.tokensService.user(user.id);
	}
}
