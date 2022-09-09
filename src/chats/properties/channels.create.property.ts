import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelsCreateProperty {
	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	password?: string;

	@ApiHideProperty()
	user_uuid: string;

	@ApiPropertyOptional()
	channel_uuid?: string;
}
