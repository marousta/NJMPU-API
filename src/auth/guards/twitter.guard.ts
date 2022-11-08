import { BadRequestException, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req, Response as Res } from 'express';

@Injectable()
export class TwitterAuthGuard extends AuthGuard('twitter') {
	private readonly logger = new Logger(TwitterAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: ExecutionContext, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid Twitter token: ' + JSON.stringify(info));
			// context.getResponse().redirect('/'); // TODO
			throw new BadRequestException('The provided authorization is invalid or expired');
		}
		const http = context.switchToHttp();
		const request: Req = http.getRequest();
		const response: Res = http.getResponse();

		request.session.destroy((e) => {
			this.logger.warn('Error when removing sesssion', e);
		});
		response.cookie('twitter_session', '', {
			expires: new Date()
		});

		return user;
	}
}
