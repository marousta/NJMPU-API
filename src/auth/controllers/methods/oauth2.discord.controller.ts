import { Controller, Get, Headers, Request, Response, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { AuthService } from '../../services/auth.service';

import { DiscordAuthGuard } from '../../guards/discord.guard';

import { DiscordUser } from '../../types';

@ApiTags('auth · OAuth2')
@Controller('auth/oauth2/discord')
export class OAuth2DiscordController {
	constructor(private readonly authService: AuthService) {}

	@UseGuards(DiscordAuthGuard)
	@ApiResponse({ status: 308, description: 'Redirect to Discord login page' })
	@Get()
	discordAuth() {}

	@ApiExcludeEndpoint()
	@UseGuards(DiscordAuthGuard)
	@Get('callback')
	async discordAuthCallback(
		@Request() req: Req,
		@Headers() headers: Headers,
		@Response({ passthrough: true }) res: Res,
	) {
		const user = req.user as DiscordUser;
		await this.authService.APIHandler(user, { req, headers, res });
		// TODO: Dispatch to admin new user created / log in
	}
}
