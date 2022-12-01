import { randomUUID } from 'crypto';

import { UsersInfos } from '../../users/entities/users.entity';

import { LobbyPlayerReadyState } from '../types';
import { WebSocketUser } from '../../websockets/types';

export class GamesLobby {
	constructor(arg: {
		uuid?: string;
		game_started?: boolean;
		game_ended?: boolean;
		matchmaking?: boolean;
		player1: UsersInfos;
		player1_color?: string;
		player1_status: LobbyPlayerReadyState;
		player1_ws?: WebSocketUser;
		player2?: UsersInfos;
		player2_color?: string;
		player2_status: LobbyPlayerReadyState;
		player2_ws?: WebSocketUser;
		spectators?: Array<UsersInfos>;
		spectators_ws?: Array<WebSocketUser>;
	}) {
		this.uuid = arg.uuid ?? randomUUID();
		this.game_started = arg.game_started ?? false;
		this.game_ended = arg.game_ended ?? false;
		this.matchmaking = arg.matchmaking ?? false;
		this.player1 = arg.player1;
		this.player1_color = arg.player1_color ?? 'white';
		this.player1_status = arg.player1_status;
		this.player1_ws = arg.player1_ws ?? null;
		this.player2 = arg.player2 ?? null;
		this.player2_color = arg.player2_color ?? 'white';
		this.player2_status = arg.player2_status;
		this.player2_ws = arg.player2_ws ?? null;
		this.spectators = arg.spectators ?? [];
		this.spectators_ws = arg.spectators_ws ?? [];
	}

	uuid: string;
	game_started: boolean;
	game_ended: boolean;
	matchmaking: boolean;
	player1: UsersInfos;
	player1_color: string;
	player1_status: LobbyPlayerReadyState;
	player1_ws: WebSocketUser;
	player2: UsersInfos;
	player2_color: string;
	player2_status: LobbyPlayerReadyState;
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
		player1_status: LobbyPlayerReadyState;
		player1_ws?: WebSocketUser;
		player1_score: number;
		player1_xp?: number;
		player2?: UsersInfos;
		player2_status: LobbyPlayerReadyState;
		player2_ws?: WebSocketUser;
		player2_score: number;
		player2_xp?: number;
		spectators?: Array<UsersInfos>;
		spectators_ws?: Array<WebSocketUser>;
		winner?: number;
		creation_date?: Date;
	}) {
		super(arg);
		this.winner = arg.winner;
		this.player1_score = arg.player1_score;
		this.player1_xp = arg.player1_xp ?? 0;
		this.player2_score = arg.player2_score;
		this.player2_xp = arg.player2_xp ?? 0;
		this.creation_date = arg.creation_date ?? new Date();
	}

	winner: number;
	player1_score: number;
	player1_xp: number;
	player2_score: number;
	player2_xp: number;
	creation_date: Date;
}
