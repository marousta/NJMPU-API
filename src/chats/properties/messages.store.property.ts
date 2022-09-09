import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class MessageStoreProperty {
	@ApiHideProperty()
	user_uuid: string;

	@ApiHideProperty()
	channel_uuid: string;

	@ApiProperty()
	message: string;
}
