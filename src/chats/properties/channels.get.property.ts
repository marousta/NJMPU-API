import { ApiProperty } from '@nestjs/swagger';

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
	moderator: string;

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
	page_count: number;
}

export class ChannelGetResponse extends ChannelData {}
