import { ApiProperty } from '@nestjs/swagger';

export class GamesJoinProperty {
	@ApiProperty()
	websocket_uuid: string;
}

export class GamesLobbyInviteProperty extends GamesJoinProperty {
	@ApiProperty()
	user_uuid: string;
}
