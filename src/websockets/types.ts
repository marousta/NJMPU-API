export enum WsEvents {
	Ping,
	Chat,
	Game,
	Session
}

export enum ChatState {
	Join,
	Leave,
	Send,
	Delete
}

export interface ChatData {
	state: ChatState;
	uuid?: string;
	password?: string;
	message?: string;
}

export interface SubscribedChannels {
	[key: string]: string[];
}

interface DispatchChannel {
	event: WsEvents.Chat;
	state: ChatState;
	user: string;
	channel: string;
}

export interface DispatchChannelJoin extends DispatchChannel {
	state: ChatState.Join;
}

export interface DispatchChannelLeave extends DispatchChannel {
	state: ChatState.Leave;
}

export interface DispatchChannelSend extends DispatchChannel {
	state: ChatState.Send;
	id: number;
	message: string;
	creation_date: Date;
}

export interface DispatchChannelDelete extends DispatchChannel {
	state: ChatState.Delete;
	id: number;
}

export interface DispatchSessionDestroyed {
	event: WsEvents.Session;
	state: 0;
}
