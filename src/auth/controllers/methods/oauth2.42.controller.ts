import { Controller, Get, Headers, Request, Response, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../../services/auth.service';

import { Intra42AuthGuard } from '../../guards/42.guard';

import { Intra42User } from '../../types';

@ApiTags('auth · OAuth2')
@Controller('auth/oauth2/42')
export class OAuth2Intra42Controller {
	constructor(private readonly authService: AuthService) {}

	@UseGuards(Intra42AuthGuard)
	@ApiResponse({ status: 308, description: 'Redirect to 42 login page' })
	@Get()
	intra42Auth() {}

	@ApiExcludeEndpoint()
	@UseGuards(Intra42AuthGuard)
	@Get('callback')
	async intra42AuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user = req.user as Intra42User;
		await this.authService.APIHandler(user, { req, headers, res });
		// TODO: Dispatch to admin new user created / log in
	}
}
