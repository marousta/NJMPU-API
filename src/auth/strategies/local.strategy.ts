import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
	private readonly logger = new Logger(LocalStrategy.name);

	constructor(private readonly authService: AuthService) {
		super({
			usernameField: 'email'
		});
	}

	async validate(email: string, password: string): Promise<any> {
		if (!email || !password) {
			this.logger.verbose('Missing credentials');
			throw new BadRequestException('Missing credentials');
		}
		return await this.authService.validateUser(email, password);
	}
}
