import { forwardRef, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'ws';

import { UsersService } from '../users/services/users.service';
import { GamesLobbyService } from '../games/services/lobby.service';
import { GamesMatchmakingService } from '../games/services/matchmaking.service';

import { ChatsChannels } from '../chats/entities/channels.entity';
import { GamesLobby } from '../games/entities/lobby';
import { UsersInfos } from '../users/entities/users.entity';

import { wsLogger } from './ws.logger';

import { peerOrPeers as PeerOrPeers } from '../utils';

import { Jwt, JwtData } from '../auth/types';
import { NotifcationType, UserStatus } from '../users/types';
import {
	ChatAction,
	SubscribedDictionary,
	WsChatCreate,
	WsChatMessageDelete,
	WsChatDemote,
	WsChatJoin,
	WsChatLeave,
	WsChatRemove,
	WsChatPromote,
	WsChatMessageSend,
	WsNamespace,
	WsUserRefresh,
	WsChatBan,
	WsChatUnban,
	WsChatMute,
	WsChatUnmute,
	WsChatAvatar,
	WsUserAvatar,
	UserAction,
	WsUserExpired,
	WsUserSession,
	WsUserUpdateSession,
	WsUserBlock,
	WsUserUnblock,
	WebSocketUser,
	WsUserNotificationRead,
	WsUserUnfriend,
	GameAction,
	WsGameJoin,
	WsGameLeave,
	WsGameReady,
	WsGameSpectate,
	WsGameStart,
	WsUserNotificationFriendRequest,
	WsUserNotificationGameInvite,
	WsGameInvite,
	WsUserStatus,
	WsUserStatusInGame,
	WsGameDisband,
	WsGameDecline,
	WsGameWait,
	WsGameMatch,
	WsGameEnd,
	WsMeta,
} from './types';
import { colors } from '../types';
@Injectable()
export class WsService {
	private readonly logger = new wsLogger(WsService.name);
	public ws: Server = null;
	private subscribed: SubscribedDictionary = {};

	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>,
		@Inject(forwardRef(() => UsersService))
		private readonly usersService: UsersService,
		private readonly lobbyService: GamesLobbyService,
		private readonly matchmakingService: GamesMatchmakingService,
	) {}

	/**
	 * Utils
	 */
	//#region

	private tokenHasExpired(exp: number) {
		return exp * 1000 < new Date().valueOf();
	}

	private send(client: WebSocketUser, data: any) {
		if (this.tokenHasExpired(client.jwt.token.exp)) {
			this.logger.warn(client.jwt.token.exp * 1000, new Date().valueOf());
			const expired: WsUserExpired = {
				namespace: WsNamespace.User,
				action: UserAction.Expired,
			};
			client.send(JSON.stringify(expired));
			this.logger.verbose(`Token for client with user ${client.jwt.infos.uuid} has expired`);
			return false;
		}

		// this.logger.set(client.uuid).debug('Data sent').unset();
		client.send(JSON.stringify(data));
		return true;
	}

	private processSend(user_uuid: string, data: any, ignore_list?: Array<string>) {
		if (!this.subscribed[user_uuid]) {
			this.logger.verbose(`No connected client to dispatch data`);
			return null;
		}

		let i = 0;
		this.subscribed[user_uuid].forEach((client) => {
			if (ignore_list?.includes(client.uuid)) {
				return;
			}
			this.send(client, data);
			++i;
		});

		return i;
	}
	//#endregion

	/**
	 * Serivce
	 */
	//#region

	setLobby(jwt: JwtData, websocket_uuid: string, lobby_uuid: string, spectate: boolean) {
		const user_uuid = jwt.infos.uuid;
		const token_uuid = jwt.token.tuuid;

		// User not connected
		if (!this.subscribed[user_uuid]) {
			return;
		}

		let ret: Array<WebSocketUser> = [];
		for (const client of this.subscribed[user_uuid]) {
			if (client.uuid !== websocket_uuid || client.jwt.token.tuuid !== token_uuid) {
				continue;
			}

			client.lobby = { uuid: lobby_uuid, spectate };
			ret.push(client);

			if (!lobby_uuid) {
				this.logger
					.set(client.uuid)
					.debug('Cleared lobby ' + client.lobby.uuid)
					.unset();
			}
		}
		return ret.length === 1 ? ret[0] : null;
	}

	unsetLobby(jwt: JwtData, websocket_uuid: string) {
		this.setLobby(jwt, websocket_uuid, null, false);
	}

	unsetAllLobby(lobby: GamesLobby) {
		const users = this.lobbyService.getUsers(lobby);
		users.map((user_uuid) => {
			this.subscribed[user_uuid]?.map((client) => {
				if (client.lobby.uuid === lobby.uuid) {
					this.logger
						.set(client.uuid)
						.debug('Cleared lobby ' + lobby.uuid)
						.unset();
					client.lobby = { uuid: null, spectate: false };
				}
			});
		});
	}

	updateClient(args: { jwt?: Jwt; user?: UsersInfos }) {
		const jwt = args.jwt;
		const user = args.user;

		if (!jwt && !user) {
			this.logger.warn(
				'updateClient fail safe | ' + jwt?.uuuid
					? 'jwt defined'
					: 'jwt undefined' + ' | ' + user?.uuid
					? 'user defined'
					: 'user undefined' + ' |',
			);
			return;
		}

		const uuid = jwt?.uuuid || user?.uuid;
		if (!this.subscribed[uuid]) {
			return;
		}

		for (const client of this.subscribed[uuid]) {
			if (jwt?.tuuid === client.jwt.token.tuuid) {
				this.logger.set(client.uuid).verbose('Token updated').unset();
				client.jwt.token = jwt;
			}
			if (user?.uuid === client.jwt.infos.uuid) {
				this.logger.set(client.uuid).verbose('User updated').unset();
				client.jwt.infos = user;
			}
		}
	}

	async updateUserStatus(user: UsersInfos, status: UserStatus, lobby_uuid?: string) {
		if (status === UserStatus.InGame) {
			await this.usersService.update.status(user.uuid, status);

			this.dispatch.all({
				namespace: WsNamespace.User,
				action: UserAction.Status,
				user: user.uuid,
				status: status,
				lobby_uuid,
			});

			return false;
		}

		// Check if user is really online
		if (status === UserStatus.Online && this.subscribed[user.uuid]) {
			await this.usersService.update.status(user.uuid, status);

			this.dispatch.all({
				namespace: WsNamespace.User,
				action: UserAction.Status,
				user: user.uuid,
				status: UserStatus.Online,
			});

			return false;
		}

		// Check if user is really offline
		const closed =
			!this.subscribed[user.uuid] ||
			this.subscribed[user.uuid].filter((client) => client.readyState === client.OPEN)
				.length === 0;

		if (closed) {
			await this.usersService.update.status(user.uuid, status);

			this.dispatch.all({
				namespace: WsNamespace.User,
				action: UserAction.Status,
				user: user.uuid,
				status: UserStatus.Offline,
			});
			return true;
		}
	}

	findAllConnected(user_uuid: string) {
		if (!this.subscribed[user_uuid]) {
			return { status: UserStatus.Offline };
		}

		let clients: Array<WebSocketUser> = [];

		for (const client of this.subscribed[user_uuid]) {
			if (client.readyState !== client.OPEN) {
				continue;
			}
			if (client.lobby.uuid) {
				return { status: UserStatus.InGame, lobby: client.lobby.uuid };
			}

			clients.push(client);
		}
		if (clients.length === 0) {
			return { status: UserStatus.Offline };
		}
		return { status: UserStatus.Online, clients };
	}

	getUserStatus(user_uuid: string) {
		if (!this.subscribed[user_uuid]) {
			return { status: UserStatus.Offline };
		}

		for (const client of this.subscribed[user_uuid]) {
			if (client.readyState !== client.OPEN) {
				continue;
			}
			if (client.lobby.uuid) {
				return { status: UserStatus.InGame, lobby: client.lobby.uuid };
			}
			return { status: UserStatus.Online, jwt: client.jwt };
		}
		return { status: UserStatus.Offline };
	}

	public readonly dispatch = {
		all: (
			data:
				| WsChatCreate
				| WsChatRemove
				| WsChatAvatar
				| WsUserAvatar
				| WsUserStatus
				| WsUserStatusInGame,
		) => {
			let i: number | null = 0;
			for (const [key] of Object.entries(this.subscribed)) {
				const ret = this.processSend(key, data);

				if (ret === null) {
					continue;
				} else if (ret === 0) {
					this.logger.warn(
						'Websocket tried to send data on empty user, this should not happen',
					);
					continue;
				}

				i += ret;
			}

			if (i === 0) {
				this.logger.verbose(`No data sent`);
				return;
			}

			switch (data.namespace) {
				case WsNamespace.Chat:
					switch (data.action) {
						case ChatAction.Create:
							this.logger.verbose(
								`Created channel ${
									data.channel
								} dispatched to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
						case ChatAction.Remove:
							this.logger.verbose(
								`Removed channel ${
									data.channel
								} dispatched to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
						case ChatAction.Avatar:
							this.logger.verbose(
								`Updated channel avatar for ${
									data.channel
								} dispatched to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
					}
					break;
				case WsNamespace.User:
					switch (data.action) {
						case UserAction.Avatar:
							this.logger.verbose(
								`Updated avatar for user ${
									data.user
								} dispatched to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
						case UserAction.Status:
							switch (data.status) {
								case UserStatus.Offline:
									this.logger.verbose(
										`User ${data.user} is ${colors.red}OFFLINE${
											colors.cyan
										} dispatched to ${i} connected ${PeerOrPeers(i)}${
											colors.end
										}`,
									);
									break;
								case UserStatus.Online:
									this.logger.verbose(
										`User ${data.user} is ${colors.green}ONLINE${
											colors.cyan
										} dispatched to ${i} connected ${PeerOrPeers(i)}${
											colors.end
										}`,
									);
									break;
								case UserStatus.InGame:
									this.logger.verbose(
										`User ${data.user} is ${colors.yellow}IN GAME${
											colors.cyan
										} ${
											(data as WsUserStatusInGame).lobby_uuid
										} dispatched to ${i} connected ${PeerOrPeers(i)}${
											colors.end
										}`,
									);
									break;
							}
							break;
					}
			}
		},
		user: (
			uuid: string,
			data:
				| WsChatCreate
				| WsUserRefresh
				| WsUserSession
				| WsUserUpdateSession
				| WsUserNotificationFriendRequest
				| WsUserNotificationGameInvite
				| WsUserBlock
				| WsUserUnblock
				| WsUserNotificationRead
				| WsUserUnfriend
				| WsGameWait
				| WsGameMatch,
		) => {
			const i = this.processSend(uuid, data);
			if (i === null) {
				return;
			} else if (i === 0) {
				this.logger.warn(
					'Websocket tried to send data on empty user, this should not happen',
				);
				return;
			}

			if (process.env['PRODUCION']) {
				return;
			}

			switch (data.namespace) {
				case WsNamespace.Chat:
					this.logger.verbose(
						`Created direct channel ${
							data.channel
						} dispatched to ${i} connected ${PeerOrPeers(i)}`,
					);
					break;
				case WsNamespace.Game:
					switch (data.action) {
						case GameAction.Wait:
							return this.logger.verbose(
								`User ${uuid} WAITING for a game broadcasted to ${i} subscribed ${PeerOrPeers(
									i,
								)}`,
							);
						case GameAction.Match:
							return this.logger.verbose(
								`Lobby ${
									data.lobby.uuid
								} FOUND broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
							);
					}
				case WsNamespace.User:
					switch (data.action) {
						case UserAction.Refresh:
							this.logger.verbose(
								`Token recheck forced on ${uuid} for ${i} connected ${PeerOrPeers(
									i,
								)}`,
							);
							break;
						case UserAction.Session:
							this.logger.verbose(
								`Update session for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
									i,
								)}`,
							);
							break;
						case UserAction.Notification:
							switch (data.type) {
								case NotifcationType.AcceptedFriendRequest:
									this.logger.verbose(
										`${uuid} accepted a friend request from ${
											data.user
										} broadcasted to ${i} connected ${PeerOrPeers(i)}`,
									);
									break;
								case NotifcationType.FriendRequest:
									this.logger.verbose(
										`${uuid} sent a friend request for ${
											data.user
										} broadcasted to ${i} connected ${PeerOrPeers(i)}`,
									);
									break;
								case NotifcationType.GameInvite:
									this.logger.verbose(
										`${uuid} invite to game ${
											data.user
										} broadcasted to ${i} connected ${PeerOrPeers(i)}`,
									);
									break;
							}
							break;
						case UserAction.Block:
							this.logger.verbose(
								`Blocked user for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
									i,
								)}`,
							);
							break;
						case UserAction.Unblock:
							this.logger.verbose(
								`Unblocked user for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
									i,
								)}`,
							);
							break;
						case UserAction.Unfriend:
							this.logger.verbose(
								`Unfriend users ${uuid} <-> ${
									data.user
								} broadcasted to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
						case UserAction.Read:
							this.logger.verbose(
								`Read notification ${
									data.uuid
								} broadcasted to ${i} connected ${PeerOrPeers(i)}`,
							);
							break;
					}
			}
		},
		channel: (
			users: Array<string>,
			data:
				| WsChatJoin
				| WsChatLeave
				| WsChatRemove
				| WsChatMessageSend
				| WsChatMessageDelete
				| WsChatPromote
				| WsChatDemote
				| WsChatBan
				| WsChatUnban
				| WsChatMute
				| WsChatUnmute
				| WsChatAvatar,
		) => {
			const user_uuid = data.user;
			const channel_uuid = data.channel;

			let i: number | null = 0;
			for (const uuid of users) {
				if (!this.subscribed[uuid]) {
					continue;
				}

				const ret = this.processSend(uuid, data);

				if (ret === null) {
					continue;
				} else if (ret === 0) {
					this.logger.warn(
						'Websocket tried to send data on empty user, this should not happen',
					);
					continue;
				}

				i += ret;
			}

			if (process.env['PRODUCION']) {
				return;
			}

			switch (data.action) {
				case ChatAction.Join:
					return this.logger.verbose(
						`${user_uuid} JOIN channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Leave:
					return this.logger.verbose(
						`${user_uuid} LEAVE channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Send:
					return this.logger.verbose(
						`New message in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Delete:
					return this.logger.verbose(
						`Deleted message id ${
							data.uuid
						} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Remove:
					return this.logger.verbose(
						`Removed channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Promote:
					return this.logger.verbose(
						`Promoted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Demote:
					return this.logger.verbose(
						`Demoted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Ban:
					return this.logger.verbose(
						`Banned ${user_uuid} in channel ${channel_uuid} ${
							data.expiration ? 'until ' + data.expiration : 'permanently'
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case ChatAction.Unban:
					return this.logger.verbose(
						`Unbanned ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Mute:
					return this.logger.verbose(
						`Muted ${user_uuid} in channel ${channel_uuid} ${
							data.expiration ? 'until ' + data.expiration : 'permanently'
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case ChatAction.Unmute:
					return this.logger.verbose(
						`Unmuted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case ChatAction.Avatar:
					this.logger.verbose(
						`Updated channel avatar for channel ${
							data.channel
						} dispatched to ${i} connected ${PeerOrPeers(i)}`,
					);
					break;
			}
		},
		lobby: (
			lobby: GamesLobby,
			data:
				| WsGameInvite
				| WsGameDecline
				| WsGameJoin
				| WsGameSpectate
				| WsGameReady
				| WsGameStart
				| WsGameLeave
				| WsGameDisband
				| WsGameEnd,
			ignore_list?: Array<string>,
		) => {
			let i: number | null = 0;

			for (const key of Object.keys(this.subscribed)) {
				const ret = this.processSend(key, data, ignore_list);

				if (ret === null) {
					continue;
				} else if (ret === 0 && !ignore_list) {
					this.logger.warn(
						'Websocket tried to send data on empty user, this should not happen',
					);
					continue;
				}

				i += ret;
			}

			if (i === 0) {
				this.logger.verbose(`No data sent`);
				return;
			}

			//
			// Dispatch to lobby users only
			//
			// const users = this.lobbyService.getUsers(lobby);

			// for (const uuid of users) {
			// 	if (!this.subscribed[uuid]) {
			// 		continue;
			// 	}

			// 	for (const client of this.subscribed[uuid]) {
			// 		if (client.lobby.uuid !== lobby.uuid) {
			// 			continue;
			// 		}

			// 		this.logger.set(client.uuid);
			// 		const ret = this.send(client, data);
			// 		this.logger.unset();
			// 		if (ret === false) {
			// 			continue;
			// 		}

			// 		i++;
			// 	}
			// }

			if (process.env['PRODUCION']) {
				return;
			}

			switch (data.action) {
				case GameAction.Invite:
					return this.logger.verbose(
						`${data.user_uuid} INVITED in lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Decline:
					return this.logger.verbose(
						`${data.user_uuid} DECLINE invitation to lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Join:
					return this.logger.verbose(
						`${data.user_uuid} JOIN lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Spectate:
					return this.logger.verbose(
						`${data.user_uuid} SPECTATE lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Ready:
					return this.logger.verbose(
						`Player ${data.user_uuid} is READY for lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Start:
					return this.logger.verbose(
						`Game for lobby ${
							lobby.uuid
						} has STARTED broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Leave:
					return this.logger.verbose(
						`${data.user_uuid} LEAVE lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`,
					);
				case GameAction.Disband:
					return this.logger.verbose(
						`Lobby ${lobby.uuid} DISBAND broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
				case GameAction.End:
					return this.logger.verbose(
						`Game ${lobby.uuid} has ENDED broadcasted to ${i} subscribed ${PeerOrPeers(
							i,
						)}`,
					);
			}
		},
		client: (clients: Array<WebSocketUser>, data: any) => {
			let i: number | null = 0;
			for (const client of clients) {
				this.send(client, data);
				i++;
			}

			if (i === 0) {
				this.logger.verbose(`No data sent`);
				return;
			}
		},
	};

	async connected(client: WebSocketUser) {
		const user_uuid = client.jwt.infos.uuid;
		if (!this.subscribed) {
			this.subscribed;
		}

		if (!this.subscribed[user_uuid]) {
			let channels: Array<ChatsChannels> = null;
			if (!process.env['PRODUCTION']) {
				channels = await this.channelRepository
					.find({
						select: { uuid: true },
						where: { users: { uuid: user_uuid } },
					})
					.then((r) => (r.length ? r : null))
					.catch((e) => {
						this.logger.error('Cannot get channels', e);
						throw new UnprocessableEntityException();
					});
			}

			this.subscribed[user_uuid] = [];
			this.subscribed[user_uuid].push(client);
			this.logger.verbose('Connected ' + user_uuid);

			const len = channels ? channels.length : 0;
			if (len) {
				this.logger.verbose(
					`Subscribed to ${len != 1 ? 'channels' : 'channel'} ${JSON.stringify(
						channels.map((c) => c.uuid),
					)}`,
				);
			} else {
				this.logger.verbose('Not subscribed to any channel');
			}
			await this.updateUserStatus(client.jwt.infos, UserStatus.Online);
		} else {
			this.subscribed[user_uuid].push(client);
			this.logger.verbose('Connected ' + user_uuid);
		}
		client.send(
			JSON.stringify({
				namespace: WsNamespace.Meta,
				uuid: client.uuid,
			} as WsMeta),
		);
	}

	async disconnected(client: WebSocketUser) {
		const user_uuid = client.jwt.infos.uuid;

		this.matchmakingService.queue.remove(client.jwt);

		if (client.lobby.uuid !== null) {
			this.lobbyService.lobby.leave(client.jwt, client.lobby.uuid, true);
		}

		await this.updateUserStatus(client.jwt.infos, UserStatus.Offline);

		// Check if user is subscribed
		if (user_uuid && this.subscribed && this.subscribed[user_uuid]) {
			// Remove client
			this.subscribed[user_uuid].forEach((c, i) => {
				if (c.uuid === client.uuid) {
					delete this.subscribed[user_uuid][i];
				}
				this.subscribed[user_uuid] = this.subscribed[user_uuid].filter((entry) => entry);
			});
			if (!this.subscribed[user_uuid].length) {
				// All connections are closed removing user
				delete this.subscribed[user_uuid];

				this.logger.verbose('No more connected client with user ' + user_uuid);
			}
		}
		this.logger.verbose('Disconnected ' + user_uuid);
	}
	//#endregion
}
