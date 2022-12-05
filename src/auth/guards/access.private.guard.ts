import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AccessPrivateAuthGuard extends AuthGuard('private') {
	private readonly logger = new Logger(AccessPrivateAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid ACCESS PRIVATE JWT: ' + JSON.stringify(info));
			throw new UnauthorizedException();
		}
		return user;
	}
}
