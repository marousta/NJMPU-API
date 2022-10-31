import { Controller, Get, Headers, Request, Response, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../../services/auth.service';

import { TwitterAuthGuard } from '../../guards/twitter.guard';
import { TwitterUser } from '../../types';

@ApiTags('auth · OAuth2')
@Controller('auth/oauth2/twitter')
export class OAuth2TwitterController {
	constructor(private readonly authService: AuthService) {}

	@UseGuards(TwitterAuthGuard)
	@ApiResponse({ status: 308, description: 'Redirect to Twitter login page' })
	@Get()
	twitterAuth() {}

	@ApiExcludeEndpoint()
	@UseGuards(TwitterAuthGuard)
	@Get('callback')
	async twitterAuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res
	) {
		const user = req.user as TwitterUser;
		await this.authService.APIHandler(user, { req, headers, res });
		// TODO: Dispatch to admin new user created / log in
	}
}
