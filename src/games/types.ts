import { GamesLobby } from './entities/queue';
import { PongServer } from './logic/PongServer';

export enum LobbyPlayerReadyState {
	Invited,
	Joined,
	Ready,
}

export enum LobbyWinner {
	Player1,
	Player2,
	Tie,
}

export interface LobbyDictionary {
	[uuid: string]: GamesLobby;
}

export interface GameDictionary {
	[uuid: string]: {
		pong: PongServer;
		interval: NodeJS.Timer;
	};
}

export enum ApiResponseError {
	LobbyNotFound = "Lobby doesn't exist",
	NotInLobby = "You're not in this lobby",
	AlreadyIn = "You're already in this lobby",
	InvalidInvitation = 'Invalid invitation',
	GameFull = 'This game is full',
	NotConnected = 'Not connected',
	AlreadyInGame = 'Already in game',
	NotOnline = 'No online client',
	AlreadyInQueue = 'Already in queue',
	NotInQueue = 'Not in queue',
	NoConnection = 'non-existent connection',
	NotLobbyLeader = "You're not lobby leader",
	NotFoundPlayer = 'Player not found in this lobby',
	ForbiddenInMatchmaking = 'Action not allowed in matchmaking',
}
