import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class TwoFactorAuthGuard extends AuthGuard('twofactor') {
	private readonly logger = new Logger(TwoFactorAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			this.logger.verbose('Invalid 2FA JWT: ' + JSON.stringify(info));
			throw new ForbiddenException();
		}
		return user;
	}
}
