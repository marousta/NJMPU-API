import {
	Body,
	Controller,
	Get,
	HttpCode,
	Post,
	Request,
	Response,
	UseGuards,
	BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../services/auth.service';
import { TokensService } from '../tokens/tokens.service';

import { RefreshAuthGuard } from '../guards/refresh.guard';

import { SignupProperty } from '../properties/signup.property';

import { getMethods } from '../authMethods';

import { isEmpty } from '../../utils';

import { JwtData, ApiResponseError } from '../types';
import { ApiResponseError as ApiResponseErrorUser } from '../../users/types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly configService: ConfigService,
		private readonly authService: AuthService,
		private readonly tokensService: TokensService,
	) {}

	/**
	 * Show available auth methods
	 */
	@Get('available')
	@ApiResponse({
		status: 200,
		description: 'available auth methods',
		type: String,
		isArray: true,
	})
	@HttpCode(200)
	authMethods() {
		return getMethods();
	}

	/**
	 * Sign up
	 */
	@ApiBody({ type: SignupProperty })
	@ApiResponse({ status: 201, description: 'User created' })
	@ApiResponse({ status: 400.01, description: ApiResponseError.EmptyFields })
	@ApiResponse({ status: 400.02, description: ApiResponseError.PasswordMismatch })
	@ApiResponse({ status: 400.03, description: ApiResponseError.EmailInvalid })
	@ApiResponse({ status: 400.04, description: ApiResponseError.UsernameTooLong })
	@ApiResponse({ status: 400.05, description: ApiResponseError.UsernameWrongFormat })
	@ApiResponse({ status: 400.06, description: ApiResponseError.PasswordEmpty })
	@ApiResponse({ status: 400.07, description: ApiResponseError.PasswordTooShort })
	@ApiResponse({ status: 400.08, description: ApiResponseError.PasswordTooLong })
	@ApiResponse({ status: 400.09, description: ApiResponseError.PasswordWrongFormatCase })
	@ApiResponse({ status: 400.10, description: ApiResponseError.PasswordWrongFormatNumeric })
	@ApiResponse({ status: 400.11, description: ApiResponseError.PasswordWrongFormatSpecial })
	@ApiResponse({ status: 400.12, description: ApiResponseErrorUser.EmailTaken })
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

		if (params.password !== params.confirm) {
			throw new BadRequestException(ApiResponseError.PasswordMismatch);
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
			(req.user as JwtData).token.tuuid,
		);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
		// TODO: Dispatch to admin token refresh
	}
}
