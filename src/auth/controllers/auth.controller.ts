import {
	Body,
	Controller,
	Headers,
	HttpCode,
	Post,
	Request,
	Response,
	UseGuards
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../services/auth.service';
import { TokensService } from '../tokens/tokens.service';

import { LocalAuthGuard } from '../guards/local.guard';
import { RefreshAuthGuard } from '../guards/refresh.guard';

import { UsersInfos } from '../../users/entities/users.entity';

import { SigninProperty } from '../properties/signin.property';
import { SignupProperty } from '../properties/signup.property';

import { getFingerprint } from '../../utils';
import { JwtData, ApiResponseError } from '../types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly tokensService: TokensService
	) {}

	/**
	 * Sign in
	 */
	@UseGuards(LocalAuthGuard)
	@ApiBody({ type: SigninProperty })
	@ApiResponse({ status: 200, description: 'User logged in' })
	@ApiResponse({ status: 202, description: 'User as 2FA' })
	@ApiResponse({ status: 400, description: ApiResponseError.EmptyFields })
	@ApiResponse({ status: 401, description: ApiResponseError.InvalidCredentials })
	@HttpCode(200)
	@Post('signin')
	async function(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user = req.user as UsersInfos;
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
	@ApiResponse({ status: 400.1, description: ApiResponseError.EmptyFields })
	@ApiResponse({ status: 400.2, description: ApiResponseError.Passwordmismatch })
	@ApiResponse({ status: 400.3, description: ApiResponseError.EmailTaken })
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
		const jwt = req.user as JwtData;

		this.authService.user.disconnect(jwt);
		this.authService.cookie.delete(res, 'access_token');
		this.authService.cookie.delete(res, 'refresh_token');
		// TODO: Dispatch to admin user log out
	}

	/**
	 * Refresh tokens
	 */
	@UseGuards(RefreshAuthGuard)
	@ApiResponse({ status: 200, description: 'Tokens refreshed' })
	@HttpCode(200)
	@Post('refresh')
	async refresh(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const { access_token, refresh_token } = await this.tokensService.update(
			(req.user as JwtData).token.id
		);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
		// TODO: Dispatch to admin token refresh
	}
}
