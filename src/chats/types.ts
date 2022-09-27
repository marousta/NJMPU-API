export enum ChannelType {
	Public,
	Private,
	Direct
}

export interface ChatsGroupPublic {
	type: ChannelType.Public;
	name: string;
	password?: string;
	current_user_uuid: string;
	channel_uuid: string;
}

export interface ChatsGroupPrivate {
	type: ChannelType.Private;
	identifier: number;
	name: string;
	password?: string;
	current_user_uuid: string;
	channel_uuid: string;
}

export interface ChatsDirect {
	type: ChannelType.Direct;
	current_user_uuid: string;
	user_uuid: string;
}

export enum ApiResponseError {
	AlreadyInChannel = 'Already in channel',
	AlreadyModerator = 'Already a moderator',
	NotAllowed = 'Not allowed',
	NotModerator = 'Not a moderator',
	MissingChannelUUID = 'Missing channel uuid',
	MissingID = 'Missing id',
	RemoteUserNotFound = "User doesn't exist",
	ChannelNotFound = 'Channel not found',
	MessageNotFound = 'Message not found',
	WrongPassword = 'Wrong password',
	InvalidQuery = 'Invalid number in query',
	EmptyMessage = 'Empty message',
	EmptyBody = 'Empty body'
}
