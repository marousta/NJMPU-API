import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UsersFriendship, UserStatus } from '../types';

export class UsersMeResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	username: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	twofactor: boolean;

	@ApiProperty()
	avatar: string;

	@ApiPropertyOptional()
	adam: boolean;
}

export class UsersGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	username: string;

	@ApiProperty()
	avatar: string;

	@ApiProperty()
	is_online: UserStatus;

	@ApiProperty()
	friendship: UsersFriendship;

	@ApiProperty()
	is_blocked: boolean;

	@ApiProperty()
	has_blocked: boolean;
}
