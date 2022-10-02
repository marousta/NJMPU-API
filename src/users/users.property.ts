import { ApiProperty } from '@nestjs/swagger';

export class UserGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	username: string;

	@ApiProperty()
	twofactor: boolean;

	@ApiProperty()
	avatar: string;

	@ApiProperty()
	is_online: boolean;
}
