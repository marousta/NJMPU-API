import { ApiProperty } from '@nestjs/swagger';
import { NotifcationType } from '../types';

export class NotificationsData {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	type: NotifcationType;

	@ApiProperty()
	user: string;

	@ApiProperty()
	time: Date;

	@ApiProperty()
	read: boolean;
}

export class NotificationsGetResponse {
	@ApiProperty({ isArray: true, type: NotificationsData })
	data: Array<NotificationsData>;

	@ApiProperty()
	count: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	page_count: number;
}
