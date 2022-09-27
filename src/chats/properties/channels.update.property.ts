import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ChannelModeratorState {
	Remove,
	Add
}

export class ChannelModeratorProperty {
	@ApiProperty()
	state: ChannelModeratorState;

	@ApiHideProperty()
	current_user_uuid: string;

	@ApiProperty()
	user_uuid: string;

	@ApiHideProperty()
	channel_uuid: string;
}

export class ChannelSettingProperty {
	@ApiPropertyOptional()
	password: string;

	@ApiPropertyOptional()
	avatar?: string;

	@ApiHideProperty()
	channel_uuid: string;

	@ApiHideProperty()
	user_uuid: string;
}
