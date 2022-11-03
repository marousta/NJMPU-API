import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class TwitterAuthGuard extends AuthGuard('twitter') {
	private readonly logger = new Logger(TwitterAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			console.log(err);
			this.logger.verbose('Invalid Twitter token');
			// context.getResponse().redirect('/'); // TODO
			throw new BadRequestException('The provided authorization is invalid or expired');
		}
		return user;
	}
}