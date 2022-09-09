import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelsGetProperty {
	@ApiPropertyOptional()
	page: number;

	@ApiPropertyOptional()
	limit: number;

	@ApiPropertyOptional()
	offset: number;
}

class Data {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	identifier: number;

	@ApiProperty()
	password: boolean;
}

export class ChannelsGetReponse {
	@ApiProperty({ type: [Data] })
	data: Data[];

	@ApiProperty()
	count: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	pageCount: number;
}

export class ChannelGetReponse extends Data {
	@ApiProperty()
	users: string[];
}
