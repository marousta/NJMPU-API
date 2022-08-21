import { ApiProperty } from '@nestjs/swagger';

export class SigninProperty {
	@ApiProperty()
	username: string;

	@ApiProperty()
	password: string;
}
