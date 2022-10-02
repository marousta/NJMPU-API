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

export class ChannelModeratorProperty {
	@ApiProperty()
	action: ChatAction;

	@ApiHideProperty()
	current_user_uuid: string;

	@ApiProperty()
	user_uuid: string;

	@ApiPropertyOptional()
	expiration: number;

	@ApiHideProperty()
	channel_uuid: string;

	@ApiHideProperty()
	avatar: string;
}

export interface ChannelAvatarProperty {
	action: ChatAction;
	current_user_uuid: string;
	channel_uuid?: string;
	avatar: string;
}
