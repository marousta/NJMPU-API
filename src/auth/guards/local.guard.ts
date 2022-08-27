import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
	private readonly logger = new Logger(LocalAuthGuard.name);

	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			this.logger.verbose('Missing credentials');
			throw new BadRequestException('Missing credentials');
		}
		return user;
	}
}
