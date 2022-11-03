import { ApiProperty } from '@nestjs/swagger';

export class SessionData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	platform: string;

	@ApiProperty()
	creation_date: Date;

	@ApiProperty()
	active: boolean;

	@ApiProperty()
	current: boolean;
}

export class SessionsGetResponse {
	@ApiProperty({ type: [SessionData] })
	data: SessionData[];

	@ApiProperty()
	count: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	page_count: number;
}

export class SessionsDeleteProperty {
	@ApiProperty()
	uuid: string;
}
