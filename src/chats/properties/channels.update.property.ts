import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ChatAction } from '../../websockets/types';

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

export class ChannelModerationProperty {
	@ApiProperty()
	user_uuid: string;

	@ApiPropertyOptional()
	expiration: number;
}

export interface ChannelModerationPropertyEX extends ChannelModerationProperty {
	action: ChatAction;
	current_user_uuid: string;
	user_uuid: string;
	channel_uuid: string;
	avatar: string;
}

export interface ChannelAvatarProperty {
	action: ChatAction;
	current_user_uuid: string;
	channel_uuid?: string;
	avatar: string;
}
