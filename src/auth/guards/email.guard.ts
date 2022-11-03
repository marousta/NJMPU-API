import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class EmailAuthGuard extends AuthGuard('local') {
	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			switch (status) {
				case 400:
					throw new BadRequestException(info.message);
				default:
					throw new UnauthorizedException();
			}
		}
		return user;
	}
}
