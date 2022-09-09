import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessagesGetProperty {
	@ApiPropertyOptional()
	page: number;

	@ApiPropertyOptional()
	limit: number;

	@ApiPropertyOptional()
	offset: number;
}

class Data {
	@ApiProperty()
	id: number;

	@ApiProperty()
	user: string;

	@ApiProperty()
	creation_date: Date;

	@ApiProperty()
	message: string;
}

export class MessagesGetReponse {
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
