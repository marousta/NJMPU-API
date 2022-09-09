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
