import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UsersInfos } from '../../users/entities/users.entity';

export enum LeaveAction {
	Leave = 'LEAVE',
	Remove = 'REMOVE',
	Kick = 'KICK'
}

export class ChannelLeaveProperty {
	@ApiPropertyOptional()
	action: LeaveAction;

	@ApiPropertyOptional()
	user_uuid?: string;

	@ApiPropertyOptional()
	current_user: UsersInfos;

	@ApiHideProperty()
	channel_uuid: string;
}
