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
	HttpException
} from '@nestjs/common';
import { ApiBody, ApiExcludeEndpoint, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { TokensService } from './tokens/tokens.service';
import { TwoFactorService } from './2fa/2fa.service';

import { LocalAuthGuard } from './guards/local.guard';
import { AccessAuthGuard } from './guards/access.guard';
import { RefreshAuthGuard } from './guards/refresh.guard';
import { TwoFactorAuthGuard } from './guards/2fa.guard';
import { Intra42AuthGuard } from './guards/42.guard';
import { DiscordAuthGuard } from './guards/discord.guard';

import { SigninProperty } from './properties/signin.property';
import { SignupProperty } from './properties/signup.property';
import { TwoFactorProperty } from './properties/2fa.property';

import { Intra42User, DiscordUser, JwtPayload } from './types';
import { getFingerprint } from '../utils';

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
	@ApiResponse({ status: 200, description: 'User logged in' })
	@ApiResponse({ status: 202, description: 'User as 2FA' })
	@ApiResponse({ status: 400, description: 'Missing credentials' })
	@ApiResponse({ status: 401, description: 'Invalid credentials' })
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
		// TODO: Dispatch to admin new user log in
	}

	/**
	 * Sign up
	 */
	@ApiBody({ type: SignupProperty })
	@ApiResponse({ status: 201, description: 'User created' })
	@ApiResponse({ status: 400, description: 'Missing fields' })
	@ApiResponse({ status: 400, description: 'Email already taken' })
	@HttpCode(201)
	@Post('signup')
	async registerLocal(@Body() params: SignupProperty) {
		await this.authService.user.create(params);
		// TODO: Dispatch to admin new user created
	}

	/**
	 * Logout
	 */
	@UseGuards(RefreshAuthGuard)
	@ApiResponse({ status: 200, description: 'Tokens destroyed' })
	@HttpCode(200)
	@Post('logout')
	async logoutLocal(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		this.authService.user.disconnect(req.user);
		this.authService.cookie.delete(res, 'access_token');
		this.authService.cookie.delete(res, 'refresh_token');
		// TODO: Dispatch to admin user log out
	}

	/**
	 * Refresh tokens
	 */
	@UseGuards(RefreshAuthGuard)
	@ApiResponse({ status: 200, description: 'Tokens refreshed' })
	@ApiResponse({ status: 401, description: 'Tokens expired or invalid' })
	@HttpCode(200)
	@Post('refresh')
	async refresh(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const { access_token, refresh_token } = await this.tokensService.update(
			(req.user as any).id
		);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
		// TODO: Dispatch to admin token refresh
	}

	/**
	 * API
	 * 42
	 */
	@UseGuards(Intra42AuthGuard)
	@ApiResponse({ status: 308, description: 'Redirect to 42 login page' })
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
		// TODO: Dispatch to admin new user created / log in
	}

	/**
	 * API
	 * Discord
	 */
	@UseGuards(DiscordAuthGuard)
	@ApiResponse({ status: 308, description: 'Redirect to Discord login page' })
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
		// TODO: Dispatch to admin new user created / log in
	}

	/**
	 * 2FA
	 */
	@UseGuards(AccessAuthGuard)
	@ApiResponse({
		status: 202,
		description: 'Create a 2FA request and return QRCode image in base64'
	})
	@ApiResponse({ status: 401, description: 'User not logged in' })
	@ApiResponse({ status: 403, description: '2FA already set' })
	@HttpCode(202)
	@Get('/2fa')
	async twoFactorCreator(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const payload = req.user as JwtPayload;
		const request = await this.authService.twoFactor.demand(payload);
		this.authService.cookie.create(res, { twofactor_token: request.token });
		return request.image;
	}

	@UseGuards(TwoFactorAuthGuard)
	@ApiBody({ type: TwoFactorProperty })
	@ApiResponse({ status: 200, description: '2FA code is valid' })
	@ApiResponse({ status: 403, description: 'No ongoing 2FA request' })
	@ApiResponse({ status: 417, description: '2FA code is invalid' })
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
}
