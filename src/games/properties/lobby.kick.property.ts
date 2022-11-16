import { ApiProperty } from '@nestjs/swagger';

export class GamesLobbyKickProperty {
	@ApiProperty()
	user_uuid: string;
}
