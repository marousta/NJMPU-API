export enum LobbyPlayerReadyState {
	Invited,
	Joined,
	Ready
}

export enum LobbyWinner {
	Player1,
	Player2,
	Tie
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
	NotInQueue = 'Not in queue'
}
