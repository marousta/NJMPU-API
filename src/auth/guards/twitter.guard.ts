import { BadRequestException, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req, Response as Res } from 'express';

import { oauth_error } from '../config';

@Injectable()
export class TwitterAuthGuard extends AuthGuard('twitter') {
	private readonly logger = new Logger(TwitterAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: ExecutionContext, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid Twitter token: ' + JSON.stringify(info));
			context.switchToHttp().getResponse().redirect(oauth_error);
			throw new BadRequestException('The provided authorization is invalid or expired');
		}
		const http = context.switchToHttp();
		const request: Req = http.getRequest();
		const response: Res = http.getResponse();

		request.session.destroy(() => {});
		response.cookie('twitter_session', '', {
			expires: new Date()
		});

		return user;
	}
}
