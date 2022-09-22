import { ChatsMessages } from './entities/messages.entity';

export enum MessageState {
	OK,
	Error
}

export interface WsMessageReponse {
	state: MessageState;
	message?: string;
	data?: ChatsMessages;
}

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
