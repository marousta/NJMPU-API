import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessagesGetProperty {
	@ApiPropertyOptional()
	page: number;

	@ApiPropertyOptional()
	limit: number;

	@ApiPropertyOptional()
	offset: number;
}

class MessageData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	user: string;

	@ApiProperty()
	creation_date: Date;

	@ApiProperty()
	message: string;
}

export class MessagesGetResponse {
	@ApiProperty({ type: [MessageData] })
	data: MessageData[];

	@ApiProperty()
	count: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	page_count: number;
}
