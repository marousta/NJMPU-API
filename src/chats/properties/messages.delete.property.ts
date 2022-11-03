import { ApiProperty } from '@nestjs/swagger';

export class MessageDeleteProperty {
	@ApiProperty()
	uuid: string;
}
