import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../services/auth.service';

import { UsersInfos } from '../../users/entities/users.entity';
import { isEmpty } from '../../utils';

@Injectable()
export class EmailStrategy extends PassportStrategy(Strategy, 'email') {
	private readonly logger = new Logger(EmailStrategy.name);

	constructor(private readonly authService: AuthService) {
		super({
			usernameField: 'email'
		});
	}

	async validate(email: string, password: string): Promise<UsersInfos> {
		if (isEmpty(email) || isEmpty(password)) {
			this.logger.verbose('Missing credentials');
			throw new BadRequestException('Missing credentials');
		}
		return await this.authService.validate(email, password);
	}
}
