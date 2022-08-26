import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class TwoFactorAuthGuard extends AuthGuard('twofactor') {
	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			throw new ForbiddenException();
		}
		return user;
	}
}
