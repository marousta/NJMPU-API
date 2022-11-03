import {
	Body,
	Controller,
	Get,
	HttpCode,
	Post,
	Request,
	Response,
	UseGuards
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../services/auth.service';
import { TokensService } from '../tokens/tokens.service';

import { RefreshAuthGuard } from '../guards/refresh.guard';

import { SignupProperty } from '../properties/signup.property';

import { authMethods } from '../authMethods';

import { JwtData, ApiResponseError } from '../types';
import { ApiResponseError as ApiUsersResponseError } from '../../users/types';
import { isEmpty } from '../../utils';
import { BadRequestException } from '@nestjs/common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly configService: ConfigService,
		private readonly authService: AuthService,
		private readonly tokensService: TokensService
	) {}

	/**
	 * Show available auth methods
	 */
	@Get('available')
	@ApiResponse({
		status: 200,
		description: 'available auth methods',
		type: String,
		isArray: true
	})
	@HttpCode(200)
	authMethods() {
		const methods = authMethods();

		return methods[0].map((m) => m.name.replace('Strategy', ''));
	}

	/**
	 * Sign up
	 */
	@ApiBody({ type: SignupProperty })
	@ApiResponse({ status: 201, description: 'User created' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.EmptyFields })
	@ApiResponse({ status: 400.2, description: ApiResponseError.PasswordMismatch })
	@ApiResponse({ status: 400.3, description: ApiUsersResponseError.EmailTaken })
	@HttpCode(201)
	@Post('signup')
	async registerLocal(@Body() params: SignupProperty) {
		if (
			isEmpty(params.username) ||
			isEmpty(params.email) ||
			isEmpty(params.password) ||
			isEmpty(params.confirm)
		) {
			throw new BadRequestException(ApiResponseError.EmptyFields);
		}

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
			(req.user as JwtData).token.tuuid
		);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
		// TODO: Dispatch to admin token refresh
	}
}
