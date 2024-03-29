import { UsersInfos } from '../users/entities/users.entity';

export enum ChannelType {
	Public,
	Private,
	Direct,
}

export enum BlacklistType {
	Ban,
	Mute,
}

export interface ChatsGroupPublic {
	type: ChannelType.Public;
	name: string;
	password?: string;
	current_user: UsersInfos;
	channel_uuid: string;
}

export interface ChatsGroupPrivate {
	type: ChannelType.Private;
	identifier: number;
	name: string;
	password?: string;
	current_user: UsersInfos;
	channel_uuid: string;
}

export interface ChatsDirect {
	type: ChannelType.Direct;
	current_user: UsersInfos;
	user_uuid: string;
}

export enum ApiResponseError {
	AlreadyInChannel = 'Already in channel',
	AlreadyModerator = 'Already a moderator',
	AlreadyBanned = 'Already banned',
	AlreadyMuted = 'Already muted',
	AlreadyDirect = 'Direct message with this user already exist',
	NotAllowed = 'Not allowed',
	MissingChannelUUID = 'Missing channel uuid',
	MissingUUID = 'Missing uuid',
	RemoteUserNotFound = 'User not found',
	ChannelNotFound = 'Channel not found',
	MessageNotFound = 'Message not found',
	ModeratorNotFound = 'User is not moderator',
	BlacklistEntryNotFound = 'User is not blacklisted',
	Banned = 'Banned',
	WrongPassword = 'Wrong password',
	PasswordTooLong = "Password are limited to 100 characters",
	InvalidQuery = 'Invalid number in query',
	DirectYourseft = "You can't DM yourself",
	EmptyMessage = 'Empty message',
	EmptyBody = 'Empty body',
	isAdministrator = 'User is channel administrator',
	MessageTooLong = 'Message too long',
	NameTooLong = 'Channels names are limited to 26 characters',
	NameWrongFormat = 'Channels names are limited to alphanumerical characters and underscores',
}
