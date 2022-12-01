import { randomUUID } from 'crypto';

import { UsersInfos } from '../../users/entities/users.entity';

import { LobbyPlayerReadyState } from '../types';

export class GamesLobby {
	constructor(arg: {
		uuid?: string;
		in_game?: boolean;
		player1_status: LobbyPlayerReadyState;
		player2_status: LobbyPlayerReadyState;
		player1: UsersInfos;
		player2?: UsersInfos;
		spectators?: UsersInfos[];
	}) {
		this.uuid = arg.uuid ?? randomUUID();
		this.in_game = arg.in_game ?? false;
		this.player1_status = arg.player1_status;
		this.player2_status = arg.player2_status;
		this.player1 = arg.player1;
		this.player2 = arg.player2 ?? null;
		this.spectators = arg.spectators ?? [];
	}

	uuid: string;
	in_game: boolean;
	player1_status: LobbyPlayerReadyState;
	player2_status: LobbyPlayerReadyState;
	player1: UsersInfos;
	player2: UsersInfos;
	spectators: UsersInfos[];

	addSpectator(user: UsersInfos) {
		if (this.spectators === undefined) {
			this.spectators = new Array<UsersInfos>();
		}
		this.spectators.push(user);
	}
}

export interface GamesLobbyFinished extends GamesLobby {
	winner: number;
	player1_score: number;
	player2_score: number;
}
