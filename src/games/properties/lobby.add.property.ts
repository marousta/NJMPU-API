import { ApiProperty } from '@nestjs/swagger';

export class GamesLobbyInviteProperty {
	@ApiProperty()
	user_uuid: string;
}
