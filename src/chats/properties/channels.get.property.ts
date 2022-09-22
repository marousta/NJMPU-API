import { ApiProperty } from '@nestjs/swagger';
import { ChannelType } from '../types';

export class ChannelData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	type: ChannelType;

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

export class DirectData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	type: ChannelType;

	@ApiProperty()
	message_count: number;

	@ApiProperty()
	users: string[];
}

export class ChannelsGetResponse {
	@ApiProperty({ type: Array<ChannelData | DirectData> })
	data: Array<ChannelData | DirectData>;

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
export class ChannelDirectGetResponse extends DirectData {}
