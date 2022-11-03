import { Controller, Headers, HttpCode, Post, Request, Response, UseGuards } from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../../services/auth.service';

import { EmailAuthGuard } from '../../guards/email.guard';

import { UsersInfos } from '../../../users/entities/users.entity';

import { SigninProperty } from '../../properties/signin.property';

import { getFingerprint } from '../../../utils';
import { ApiResponseError } from '../../types';

@ApiTags('auth · Email')
@Controller('auth')
export class AuthEmailController {
	constructor(private readonly authService: AuthService) {}

	@UseGuards(EmailAuthGuard)
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
}
