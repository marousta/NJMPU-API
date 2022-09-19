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
	profile_picture: string;

	@ApiProperty()
	is_online: boolean;
}
