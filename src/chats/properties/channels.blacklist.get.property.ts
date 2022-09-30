import { ApiProperty } from '@nestjs/swagger';

export class BlacklistEntry {
	@ApiProperty()
	user: string;

	@ApiProperty()
	expiration: Date;
}

export class BlacklistGetResponse {
	@ApiProperty({ isArray: true, type: BlacklistEntry })
	banned: Array<BlacklistEntry>;

	@ApiProperty({ isArray: true, type: BlacklistEntry })
	muted: Array<BlacklistEntry>;
}

export interface BlacklistGetProperty {
	current_user_uuid: string;
	channel_uuid: string;
}
