import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class EmailAuthGuard extends AuthGuard('email') {
	private readonly logger = new Logger(EmailAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			switch (status) {
				case 400:
					this.logger.warn(JSON.stringify(info));
					throw new BadRequestException();
				default:
					throw new UnauthorizedException();
			}
		}
		return user;
	}
}
