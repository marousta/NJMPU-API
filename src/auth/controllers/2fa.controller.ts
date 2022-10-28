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
	HttpException,
	Delete
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../services/auth.service';
import { TwoFactorService } from '../services/2fa.service';

import { AccessAuthGuard } from '../guards/access.guard';
import { TwoFactorAuthGuard } from '../guards/2fa.guard';

import { TwoFactorProperty } from '../properties/2fa.property';

import { getFingerprint } from '../../utils';
import { ApiResponseError, JwtData } from '../types';

@ApiTags('auth · 2FA')
@Controller('auth/2fa')
export class TwoFactorController {
	constructor(
		private readonly authService: AuthService,
		private readonly twoFactorService: TwoFactorService
	) {}

	@UseGuards(AccessAuthGuard)
	@ApiResponse({
		status: 202,
		description: 'Create a 2FA request and return QRCode image in base64'
	})
	@ApiResponse({ status: 401, description: 'User not logged in' })
	@ApiResponse({ status: 403, description: ApiResponseError.TwoFactorAlreadySet })
	@HttpCode(202)
	@Get()
	async twoFactorCreator(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const user = (req.user as JwtData).infos;

		const request = await this.authService.twoFactor.demand(user);
		this.authService.cookie.create(res, { twofactor_token: request.token });

		return {
			image: request.image,
			text: request.text
		};
	}

	@UseGuards(TwoFactorAuthGuard)
	@ApiBody({ type: TwoFactorProperty })
	@ApiResponse({ status: 200, description: '2FA code is valid' })
	@ApiResponse({ status: 403, description: ApiResponseError.TwoFactorInvalidRequest })
	@ApiResponse({ status: 417, description: ApiResponseError.TwoFactorInvalidCode })
	@HttpCode(200)
	@Post()
	async twoFactorAuth(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res,
		@Body() body: TwoFactorProperty
	) {
		const jwt = req.user as any;
		const uuid = jwt.token.uuid;
		const user = jwt.infos;
		const code = body.code ? body.code : '';

		if (await this.twoFactorService.verify.code(user, uuid, code)) {
			const fingerprint = getFingerprint(req, headers);
			const tokens = await this.authService.twoFactor.login(uuid, fingerprint);
			const { access_token, refresh_token } = tokens;
			this.authService.cookie.delete(res, 'twofactor_token');
			this.authService.cookie.create(res, { access_token });
			this.authService.cookie.create(res, { refresh_token });
		} else {
			throw new HttpException(ApiResponseError.TwoFactorInvalidCode, 417);
		}
	}

	@UseGuards(AccessAuthGuard)
	@ApiResponse({ status: 200, description: '2FA removed' })
	@ApiResponse({ status: 403, description: '2FA not set' })
	@HttpCode(200)
	@Delete()
	async twoFactorRemove(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user = (req.user as JwtData).infos;

		await this.twoFactorService.remove(user);
	}
}
