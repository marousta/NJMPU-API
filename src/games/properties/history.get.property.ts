import { ApiProperty } from '@nestjs/swagger';

import { LobbyWinner } from '../types';

export class GamesHistoryGetResponse {
	@ApiProperty()
	uuid: string;

	@ApiProperty()
	winner: LobbyWinner;

	@ApiProperty({ isArray: true, type: String })
	players: [string, string];

	@ApiProperty({ isArray: true, type: Number })
	players_scores: [number, number];

	@ApiProperty({ isArray: true, type: Number })
	players_xp: [number, number];
}
