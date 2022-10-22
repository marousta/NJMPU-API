import { ApiProperty } from '@nestjs/swagger';

export class NotificationsDeleteProperty {
	@ApiProperty()
	current_user_uuid: string;

	@ApiProperty()
	notification_uuid: string;
}
