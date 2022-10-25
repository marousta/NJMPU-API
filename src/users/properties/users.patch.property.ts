import { ApiProperty } from '@nestjs/swagger';

export class UsersPatchProperty {
	@ApiProperty()
	current_password: string;

	@ApiProperty()
	new_password: string;

	@ApiProperty()
	confirm: string;
}
