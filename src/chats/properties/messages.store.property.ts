import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

import { UsersInfos } from '../../users/entities/users.entity';

export class MessageStoreProperty {
	@ApiHideProperty()
	current_user: UsersInfos;

	@ApiHideProperty()
	channel_uuid: string;

	@ApiProperty()
	message: string;
}
