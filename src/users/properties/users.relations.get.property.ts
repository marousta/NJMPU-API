import { ApiProperty } from '@nestjs/swagger';

import { UsersInfos } from '../entities/users.entity';

import { UsersFriendship } from '../types';

export class UsersRelationsProperty {
	current_user: UsersInfos;
	action: string;
	user_uuid: string;
}

export class UsersRelationsResponse {
	@ApiProperty()
	friendship: UsersFriendship;
}

export class UsersFriendshipResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	friendship: UsersFriendship;
}
