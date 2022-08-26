import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
	handleRequest(err: any, user: any, info: any, context: any, status: any) {
		if (err || !user) {
			context.getResponse().redirect('/'); // TODO
			throw new BadRequestException('The provided authorization is invalid or expired');
		}
		return user;
	}
}
