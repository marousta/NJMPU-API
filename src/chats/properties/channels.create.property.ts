import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ChannelType } from '../types';

export class ChannelsCreateProperty {
	@ApiPropertyOptional()
	type?: ChannelType;

	@ApiPropertyOptional()
	identifier?: number;

	@ApiProperty()
	name?: string;

	@ApiPropertyOptional()
	password?: string;

	@ApiHideProperty()
	current_user_uuid: string;

	@ApiProperty()
	user_uuid?: string;

	@ApiPropertyOptional()
	channel_uuid?: string;
}
