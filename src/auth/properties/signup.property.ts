import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class SignupProperty {
	@ApiHideProperty()
	adam: boolean;

	@ApiHideProperty()
	identifier: number;

	@ApiProperty()
	username: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	password: string;

	@ApiProperty()
	confirm: string;

	@ApiHideProperty()
	avatar: string;

	@ApiHideProperty()
	twofactor: string;
}
