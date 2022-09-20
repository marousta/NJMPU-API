import { ApiProperty } from '@nestjs/swagger';

export class Data {
	@ApiProperty()
	id: number;

	@ApiProperty()
	platform: string;

	@ApiProperty()
	creation_date: Date;

	@ApiProperty()
	active: boolean;
}

export class SessionsGetResponse {
	@ApiProperty({ type: [Data] })
	data: Data[];

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
	id: number;
}
