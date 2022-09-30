export interface SubscribedChannels {
	[key: string]: string[];
}

/**
 * Websocket response
 */

export enum WsNamespace {
	Chat = 'Chat',
	User = 'User',
	Game = 'Game'
}

/**
 * Chat
 */

export enum ChatAction {
	Create = 'CREATE',
	Join = 'JOIN',
	Leave = 'LEAVE',
	Remove = 'REMOVE',
	Send = 'SEND',
	Delete = 'DELETE',
	Promote = 'PROMOTE',
	Demote = 'DEMOTE',
	Ban = 'BAN',
	Unban = 'UNBAN',
	Mute = 'MUTE',
	Unmute = 'UNMUTE',
	Avatar = 'AVATAR'
}

export interface WsChat {
	namespace: WsNamespace.Chat;
	action: ChatAction;
	channel: string;
	user?: string;
}

export interface WsChatCreate extends WsChat {
	action: ChatAction.Create;
}

export interface WsChatJoin extends WsChat {
	action: ChatAction.Join;
	user: string;
}

export interface WsChatLeave extends WsChat {
	action: ChatAction.Leave;
	user: string;
}

export interface WsChatRemove extends WsChat {
	action: ChatAction.Remove;
}

export interface WsMessage {
	id: number;
	text: string;
	time: Date;
}

export interface WsChatSend extends WsChat {
	action: ChatAction.Send;
	user: string;
	message: WsMessage;
}

export interface WsChatDelete extends WsChat {
	action: ChatAction.Delete;
	id: number;
}

export interface WsChatPromote extends WsChat {
	action: ChatAction.Promote;
	user: string;
}

export interface WsChatDemote extends WsChat {
	action: ChatAction.Demote;
	user: string;
}

export interface WsChaBan extends WsChat {
	action: ChatAction.Ban;
	user: string;
	expiration: Date;
}

export interface WsChatUnban extends WsChat {
	action: ChatAction.Unban;
	user: string;
}

export interface WsChatMute extends WsChat {
	action: ChatAction.Mute;
	user: string;
	expiration: Date;
}

export interface WsChatUnmute extends WsChat {
	action: ChatAction.Unmute;
	user: string;
}

export interface WsChatAvatar extends WsChat {
	action: ChatAction.Avatar;
	path: string;
}

/**
 * User
 */

export enum UserAction {
	Invite = 'INVITE',
	Block = 'BLOCK',
	Unblock = 'UNBLOCK',
	Refresh = 'REFRESH'
}

export interface WsUser {
	namespace: WsNamespace.User;
	action: UserAction;
}

export interface WsUserRefresh extends WsUser {
	action: UserAction.Refresh;
}

/**
 * Game
 */

export interface WsGame {
	namespace: WsNamespace.Game;
	action: '';
}
