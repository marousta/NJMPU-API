import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelsGetProperty {
	@ApiPropertyOptional()
	page: number;

	@ApiPropertyOptional()
	limit: number;

	@ApiPropertyOptional()
	offset: number;
}

export class ChannelData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	password: boolean;

	@ApiProperty()
	message_count: number;

	@ApiProperty()
	users: string[];
}

export class ChannelsGetResponse {
	@ApiProperty({ type: [ChannelData] })
	data: ChannelData[];

	@ApiProperty()
	count: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	pageCount: number;
}

export class ChannelGetResponse extends ChannelData {}
