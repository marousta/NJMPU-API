import { ApiPropertyOptional } from '@nestjs/swagger';

export class GamesLobbyKickProperty {
	@ApiPropertyOptional()
	user_uuid: string;
}
