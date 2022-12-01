import { ApiProperty } from '@nestjs/swagger';

import { LobbyPlayerReadyState } from '../types';

export class GamesLobbyGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	in_game: boolean;

	@ApiProperty()
	is_matchmaking: boolean;

	@ApiProperty({ isArray: true, type: String })
	players: [string, string];

	@ApiProperty({ isArray: true, type: Number })
	players_status: [LobbyPlayerReadyState, LobbyPlayerReadyState];

	@ApiProperty({ isArray: true, type: String })
	spectators: Array<string>;

	@ApiProperty()
	max_spectators: number;
}
