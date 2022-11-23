import { WebSocket } from 'ws';

import { GamesLobbyGetResponse } from '../games/properties/lobby.get.property';

import { NotifcationType, UserStatus } from '../users/types';
import { JwtData } from '../auth/types';

export interface WebSocketUser extends WebSocket {
	uuid: string;
	jwt: JwtData;
	lobby: {
		uuid: string;
		spectate: boolean;
	};
}

export interface SubscribedDictionary {
	[user_uuid: string]: Array<WebSocketUser>;
}

/**
 * Websocket response
 */

export enum WsNamespace {
	Chat = 'Chat',
	User = 'User',
	Game = 'Game',
	Meta = 'Meta',
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
	Avatar = 'AVATAR',
}

export interface WsChat {
	namespace: WsNamespace.Chat;
	action: ChatAction;
	channel: string;
	user?: string;
}

/**
 * Chat channels
 */

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

export interface WsChatPromote extends WsChat {
	action: ChatAction.Promote;
	user: string;
}

export interface WsChatDemote extends WsChat {
	action: ChatAction.Demote;
	user: string;
}

export interface WsChatBan extends WsChat {
	action: ChatAction.Ban;
	user: string;
	expiration: Date | null;
}

export interface WsChatUnban extends WsChat {
	action: ChatAction.Unban;
	user: string;
}

export interface WsChatMute extends WsChat {
	action: ChatAction.Mute;
	user: string;
	expiration: Date | null;
}

export interface WsChatUnmute extends WsChat {
	action: ChatAction.Unmute;
	user: string;
}

export interface WsChatAvatar extends WsChat {
	action: ChatAction.Avatar;
	avatar: string;
}

/**
 * Chat messages
 */

export interface WsMessage {
	uuid: string;
	text: string;
	time: Date;
}

export interface WsChatMessageSend extends WsChat {
	action: ChatAction.Send;
	user: string;
	message: WsMessage;
}

export interface WsChatMessageDelete extends WsChat {
	action: ChatAction.Delete;
	uuid: string;
}

/**
 * User
 */

export enum UserAction {
	Unfriend = 'UNFRIEND',
	Block = 'BLOCK',
	Unblock = 'UNBLOCK',
	Refresh = 'REFRESH',
	Expired = 'EXPIRED',
	Avatar = 'AVATAR',
	Session = 'SESSION',
	Notification = 'NOTIFICATION',
	Read = 'READ',
	Status = 'STATUS',
}

export interface WsUser {
	namespace: WsNamespace.User;
	action: UserAction;
}

export interface WsUserRefresh extends WsUser {
	action: UserAction.Refresh;
}

export interface WsUserExpired extends WsUser {
	action: UserAction.Expired;
}

export interface WsUserAvatar extends WsUser {
	action: UserAction.Avatar;
	user: string;
	avatar: string;
}

export interface WsUserUpdateSession extends WsUser {
	action: UserAction.Session;
	uuid: string;
	active: boolean;
}

export interface WsUserSession extends WsUserUpdateSession {
	platform: string;
	creation_date: Date;
}

/**
 * Relations
 */

export enum BlockDirection {
	IsBlocked = 0,
	IsUnblocked = 0,
	HasBlocked = 1,
	HasUnblocked = 1,
}

export interface WsUserBlock extends WsUser {
	action: UserAction.Block;
	user: string;
	direction: BlockDirection;
}

export interface WsUserUnblock extends WsUser {
	action: UserAction.Unblock;
	user: string;
	direction: BlockDirection;
}

export interface WsUserUnfriend extends WsUser {
	action: UserAction.Unfriend;
	user: string;
}

/**
 * Notifications
 */

export interface WsUserNotificationRead extends WsUser {
	action: UserAction.Read;
	uuid: string;
}
export interface WsUserNotification extends WsUser {
	action: UserAction.Notification;
	uuid: string;
}

export interface WsUserNotificationFriendRequest extends WsUserNotification {
	type: NotifcationType.AcceptedFriendRequest | NotifcationType.FriendRequest;
	user: string;
	creation_date: Date;
}

export interface WsUserNotificationGameInvite extends WsUserNotification {
	type: NotifcationType.GameInvite;
	lobby: string;
	user: string;
}

/**
 * Status
 */

export interface WsUserStatus extends WsUser {
	action: UserAction.Status;
	user: string;
	status: UserStatus;
}

export interface WsUserStatusInGame extends WsUser {
	action: UserAction.Status;
	user: string;
	status: UserStatus.InGame;
	lobby_uuid: string;
}

/**
 * Game
 */

export enum GameAction {
	Invite = 'INVITE',
	Decline = 'DECLINE',
	Join = 'JOIN',
	Spectate = 'SPECTATE',
	Ready = 'READY',
	Start = 'START',
	Leave = 'LEAVE',
	Wait = 'WAIT',
	Match = 'MATCH',
	Disband = 'DISBAND',
}

export interface WsGame {
	namespace: WsNamespace.Game;
	action: GameAction;
	lobby_uuid: string;
}

/**
 * Lobby
 */

export interface WsGameInvite extends WsGame {
	action: GameAction.Invite;
	user_uuid: string;
}

export interface WsGameDecline extends WsGame {
	action: GameAction.Decline;
	user_uuid: string;
}

export interface WsGameJoin extends WsGame {
	action: GameAction.Join;
	user_uuid: string;
}

export interface WsGameSpectate extends WsGame {
	action: GameAction.Spectate;
	user_uuid: string;
}

export interface WsGameReady extends WsGame {
	action: GameAction.Ready;
	user_uuid: string;
}

export interface WsGameStart extends WsGame {
	action: GameAction.Start;
}

export interface WsGameLeave extends WsGame {
	action: GameAction.Leave;
	user_uuid: string;
}

export interface WsGameDisband extends WsGame {
	action: GameAction.Disband;
}

export interface WsGameWait {
	namespace: WsNamespace.Game;
	action: GameAction.Wait;
}

export interface WsGameMatch {
	namespace: WsNamespace.Game;
	action: GameAction.Match;
	lobby: GamesLobbyGetResponse;
}

/**
 * Lobby
 */

export interface WsMeta {
	namespace: WsNamespace.Meta;
	uuid: string;
}
