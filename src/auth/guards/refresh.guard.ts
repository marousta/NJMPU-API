import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshAuthGuard extends AuthGuard('refresh') {
	private readonly logger = new Logger(RefreshAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid REFRESH JWT: ' + JSON.stringify(info));
			throw new UnauthorizedException();
		}
		return user;
	}
}
