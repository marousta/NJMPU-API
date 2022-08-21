import { Body, Controller, Headers, HttpCode, Post, Request, Response, UseGuards } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Response as Res, Request as Req } from 'express';

import { LocalAuthGuard } from './guards/local.guard';
import { AuthService } from './auth.service';
import { SigninProperty } from './properties/signin.property';
import { SignupProperty } from './properties/signup.property';
import { RefreshGuard } from './guards/refresh.guard';
import { TokensService } from './tokens/tokens.service';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService, private tokensService: TokensService) {}

	//TODO: shitty code here
	private getPlatform(headers: Headers) {
		const browser_str = headers['sec-ch-ua'];
		const os_str = headers['sec-ch-ua-platform'];

		let str = browser_str.split(';');
		str.pop();
		const browser = str[str.length - 1].split(',')[1].split('"').join('');
		const os = os_str.split('"').join('');

		return `${browser} ${os}`.trim();
	}

	@UseGuards(LocalAuthGuard)
	@ApiBody({ type: SigninProperty })
	@HttpCode(200)
	@Post('signin')
	async function(@Request() req: Req, @Headers() headers: Headers, @Response({ passthrough: true }) res: Res) {
		const ip = req.ips.length ? req.ips[0] : req.ip; //TODO: check value of ips

		const platform = this.getPlatform(headers);
		const { access_token, refresh_token } = await this.authService.login(
			req.user as any,
			platform,
			headers['user-agent'],
			ip
		);

		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
	}

	@ApiBody({ type: SignupProperty })
	@HttpCode(201)
	@Post('signup')
	async registerLocal(@Body() params: SignupProperty) {
		await this.authService.user.create(params);
	}

	@UseGuards(RefreshGuard)
	@HttpCode(200)
	@Post('logout')
	async logoutLocal(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		this.authService.user.disconnect(req.user);
		this.authService.cookie.delete(res, 'access_token');
		this.authService.cookie.delete(res, 'refresh_token');
	}

	@UseGuards(RefreshGuard)
	@Post('refresh')
	async refresh(@Request() req: Req, @Response({ passthrough: true }) res: Res) {
		const { access_token, refresh_token } = await this.tokensService.update((req.user as any).id);
		this.authService.cookie.create(res, { access_token });
		this.authService.cookie.create(res, { refresh_token });
	}
}
