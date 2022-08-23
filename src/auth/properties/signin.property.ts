import { ApiProperty } from '@nestjs/swagger';

export class SigninProperty {
	@ApiProperty()
	email: string;

	@ApiProperty()
	password: string;
}
