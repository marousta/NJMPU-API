import { ApiProperty } from '@nestjs/swagger';

import { UsersInfos } from '../entities/users.entity';

import { UsersFriendship } from '../types';

export class UsersRelationsProperty {
	current_user: UsersInfos;
	action: string;
	user_uuid: string;
}

export class UsersFriendshipResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	friendship: UsersFriendship;
}

export class UsersRelationsResponse {
	@ApiProperty({ isArray: true, type: UsersFriendshipResponse })
	friendship: Array<UsersFriendshipResponse>;

	@ApiProperty({ isArray: true, type: String })
	blocklist: Array<string>;
}
