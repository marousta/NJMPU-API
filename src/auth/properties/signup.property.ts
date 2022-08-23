import { ApiProperty } from '@nestjs/swagger';

export class SignupProperty {
	@ApiProperty()
	username: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	password: string;

	@ApiProperty()
	confirm: string;
}
