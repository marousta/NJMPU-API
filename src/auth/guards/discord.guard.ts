import { BadRequestException, Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { oauth_error } from '../config';

@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
	private readonly logger = new Logger(DiscordAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: ExecutionContext, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid Discord token: ' + JSON.stringify(info));
			context.switchToHttp().getResponse().redirect(oauth_error);
			throw new BadRequestException('The provided authorization is invalid or expired');
		}
		return user;
	}
}
