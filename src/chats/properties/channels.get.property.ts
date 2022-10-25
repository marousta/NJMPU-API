import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';

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
	avatar: string;

	@ApiProperty()
	message_count: number;

	@ApiProperty()
	administrator: string;

	@ApiProperty()
	moderators: string[];

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

export class ChannelsDirectGetResponse {
	@ApiProperty({ isArray: true, type: DirectData })
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

@ApiExtraModels(ChannelsDirectGetResponse)
export class ChannelsDataGetResponse {
	@ApiProperty({ isArray: true, type: ChannelData })
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

export class ChannelPrivateProperty {
	@ApiProperty()
	name: string;

	@ApiProperty()
	identifier: number;
}

export class ChannelPrivateGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	avatar: string;
}
