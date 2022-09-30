import { ApiPropertyOptional } from '@nestjs/swagger';

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
	current_user_uuid: string;

	@ApiPropertyOptional()
	channel_uuid: string;
}
