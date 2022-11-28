import { randomUUID } from 'crypto';
import { UsersInfos } from '../../users/entities/users.entity';

import { LobbyPlayerReadyState } from '../types';
import { WebSocketUser } from '../../websockets/types';

export class GamesLobby {
	constructor(arg: {
		uuid?: string;
		in_game?: boolean;
		matchmaking?: boolean;
		player1: UsersInfos;
		player2?: UsersInfos;
		player1_status: LobbyPlayerReadyState;
		player2_status: LobbyPlayerReadyState;
		player1_ws?: WebSocketUser;
		player2_ws?: WebSocketUser;
		spectators?: Array<UsersInfos>;
		spectators_ws?: Array<WebSocketUser>;
	}) {
		this.uuid = arg.uuid ?? randomUUID();
		this.in_game = arg.in_game ?? false;
		this.matchmaking = arg.matchmaking ?? false;
		this.player1 = arg.player1;
		this.player2 = arg.player2 ?? null;
		this.player1_status = arg.player1_status;
		this.player2_status = arg.player2_status;
		this.player1_ws = arg.player1_ws ?? null;
		this.player2_ws = arg.player2_ws ?? null;
		this.spectators = arg.spectators ?? [];
		this.spectators_ws = arg.spectators_ws ?? [];
	}

	uuid: string;
	in_game: boolean;
	matchmaking: boolean;
	player1: UsersInfos;
	player2: UsersInfos;
	player1_status: LobbyPlayerReadyState;
	player2_status: LobbyPlayerReadyState;
	player1_ws: WebSocketUser;
	player2_ws: WebSocketUser;
	spectators: Array<UsersInfos>;
	spectators_ws: Array<WebSocketUser>;

	addSpectator(user: UsersInfos) {
		if (this.spectators === undefined) {
			this.spectators = new Array<UsersInfos>();
		}
		this.spectators.push(user);
	}

	addSpectatorWs(client: WebSocketUser) {
		if (this.spectators_ws === undefined) {
			this.spectators_ws = new Array<WebSocketUser>();
		}
		this.spectators_ws.push(client);
	}
}

export class GamesLobbyFinished extends GamesLobby {
	constructor(arg: {
		uuid?: string;
		in_game?: boolean;
		matchmaking?: boolean;
		player1: UsersInfos;
		player2?: UsersInfos;
		player1_status: LobbyPlayerReadyState;
		player2_status: LobbyPlayerReadyState;
		player1_ws?: WebSocketUser;
		player2_ws?: WebSocketUser;
		spectators?: Array<UsersInfos>;
		spectators_ws?: Array<WebSocketUser>;
		winner?: number;
		player1_score: number;
		player2_score: number;
	}) {
		super(arg);
		this.winner = arg.winner;
		this.player1_score = arg.player1_score;
		this.player2_score = arg.player2_score;
	}

	winner?: number;
	player1_score: number;
	player2_score: number;
}
