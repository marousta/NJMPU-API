import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AccessAuthGuard extends AuthGuard('access') {
	private readonly logger = new Logger(AccessAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid ACCESS JWT: ' + JSON.stringify(info));
			throw new UnauthorizedException();
		}
		return user;
	}
}
