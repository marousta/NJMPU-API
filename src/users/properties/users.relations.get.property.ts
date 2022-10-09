import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { UsersFriendship } from '../types';

export class UsersRelationsProperty {
	@ApiHideProperty()
	current_user_uuid: string;

	@ApiProperty()
	action: string;

	@ApiProperty()
	user_uuid: string;
}

export class UsersRelationsResponse {
	@ApiProperty()
	friendship: UsersFriendship;
}

export class UsersFriendshipGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	friendship: UsersFriendship;
}
