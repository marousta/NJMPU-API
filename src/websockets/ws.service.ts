import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'ws';

import { GamesLobbyService } from '../games/services/lobby.service';

import { ChatsChannels } from '../chats/entities/channels.entity';
import { GamesLobby } from '../games/entities/lobby.entity';

import { wsLogger } from './ws.logger';

import { peerOrPeers as PeerOrPeers } from '../utils';

import { Jwt, JwtData } from '../auth/types';
import { NotifcationType } from '../users/types';
import {
	ChatAction,
	SubscribedDictionary,
	WsChatCreate,
	WsChatDelete,
	WsChatDemote,
	WsChatJoin,
	WsChatLeave,
	WsChatRemove,
	WsChatPromote,
	WsChatSend,
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
	WsUserNotification,
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
	WsGameInvite
} from './types';
@Injectable()
export class WsService {
	private readonly logger = new wsLogger(WsService.name);
	public ws: Server = null;
	private subscribed: SubscribedDictionary = {};

	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>,
		private readonly lobbyService: GamesLobbyService
	) {}

	/**
	 * Utils
	 */
	//#region

	private tokenHasExpired(exp: number) {
		return exp * 1000 < new Date().valueOf();
	}

	updateToken(jwt: Jwt) {
		if (!this.subscribed[jwt.uuuid]) {
			return;
		}
		for (const client of this.subscribed[jwt.uuuid]) {
			if (client.jwt.token.tuuid === jwt.tuuid) {
				this.logger.set(client.uuid).verbose('Token updated').unset();
				client.jwt.token = jwt;
			}
		}
	}

	private send(client: WebSocketUser, data: any) {
		if (this.tokenHasExpired(client.jwt.token.exp)) {
			this.logger.warn(client.jwt.token.exp * 1000, new Date().valueOf());
			const expired: WsUserExpired = {
				namespace: WsNamespace.User,
				action: UserAction.Expired
			};
			client.send(JSON.stringify(expired));
			this.logger.verbose(`Token for client with user ${client.jwt.infos.uuid} has expired`);
			return false;
		}

		this.logger.set(client.uuid).debug('Data sent').unset();
		client.send(JSON.stringify(data));
		return true;
	}

	private processSend(user_uuid: string, data: any) {
		if (!this.subscribed[user_uuid]) {
			this.logger.verbose(`No connected client to dispatch data`);
			return null;
		}

		let i = 0;
		this.subscribed[user_uuid].forEach((client) => {
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

	setLobby(jwt: JwtData, lobby_uuid: string) {
		const user_uuid = jwt.infos.uuid;
		const token_uuid = jwt.token.tuuid;

		// User not connected
		if (!this.subscribed[user_uuid]) {
			return;
		}
		for (const client of this.subscribed[user_uuid]) {
			if (client.jwt.token.tuuid !== token_uuid) {
				continue;
			}
			client.lobby_uuid = lobby_uuid;
		}
	}

	public readonly dispatch = {
		all: (data: WsChatCreate | WsChatRemove | WsChatAvatar | WsUserAvatar) => {
			let i: number | null = 0;
			for (const [key] of Object.entries(this.subscribed)) {
				const ret = this.processSend(key, data);

				if (ret === null) {
					continue;
				} else if (ret === 0) {
					this.logger.warn(
						'Websocket tried to send data on empty user, this should not happend'
					);
					continue;
				}

				i += ret;
			}

			if (i === 0) {
				this.logger.verbose(`No data sent`);
				return;
			}

			if (data.namespace === WsNamespace.Chat) {
				switch (data.action) {
					case ChatAction.Create:
						this.logger.verbose(
							`Created channel ${
								data.channel
							} dispatched to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
					case ChatAction.Remove:
						this.logger.verbose(
							`Removed channel ${
								data.channel
							} dispatched to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
					case ChatAction.Avatar:
						this.logger.verbose(
							`Updated channel avatar for ${
								data.channel
							} dispatched to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
				}
				return;
			} else if (data.namespace === WsNamespace.User) {
				this.logger.verbose(
					`Updated avatar for user ${
						data.user
					} dispatched to ${i} connected ${PeerOrPeers(i)}`
				);
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
		) => {
			const i = this.processSend(uuid, data);
			if (i === null) {
				return;
			} else if (i === 0) {
				this.logger.warn(
					'Websocket tried to send data on empty user, this should not happend'
				);
				return;
			}

			if (data.namespace === WsNamespace.Chat) {
				this.logger.verbose(
					`Created direct channel ${
						data.channel
					} dispatched to ${i} connected ${PeerOrPeers(i)}`
				);
			} else if (data.namespace === WsNamespace.User) {
				switch (data.action) {
					case UserAction.Refresh:
						this.logger.verbose(
							`Token recheck forced on ${uuid} for ${i} connected ${PeerOrPeers(i)}`
						);
						break;
					case UserAction.Session:
						this.logger.verbose(
							`Update session for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
								i
							)}`
						);
						break;
					case UserAction.Notification:
						switch (data.type) {
							case NotifcationType.AcceptedFriendRequest:
								this.logger.verbose(
									`${uuid} accepted a friend request from ${
										data.user
									} broadcasted to ${i} connected ${PeerOrPeers(i)}`
								);
								break;
							case NotifcationType.FriendRequest:
								this.logger.verbose(
									`${uuid} sent a friend request for ${
										data.user
									} broadcasted to ${i} connected ${PeerOrPeers(i)}`
								);
								break;
							case NotifcationType.GameInvite:
								this.logger.verbose(
									`${uuid} invite to game ${
										data.user
									} broadcasted to ${i} connected ${PeerOrPeers(i)}`
								);
								break;
						}

						break;
					case UserAction.Block:
						this.logger.verbose(
							`Blocked user for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
								i
							)}`
						);
						break;
					case UserAction.Unblock:
						this.logger.verbose(
							`Unblocked user for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
								i
							)}`
						);
						break;
					case UserAction.Unfriend:
						this.logger.verbose(
							`Unfriend users ${uuid} <-> ${
								data.user
							} broadcasted to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
					case UserAction.Read:
						this.logger.verbose(
							`Read notification ${
								data.uuid
							} broadcasted to ${i} connected ${PeerOrPeers(i)}`
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
				| WsChatSend
				| WsChatDelete
				| WsChatPromote
				| WsChatDemote
				| WsChatBan
				| WsChatUnban
				| WsChatMute
				| WsChatUnmute
				| WsChatAvatar
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
						'Websocket tried to send data on empty user, this should not happend'
					);
					continue;
				}

				i += ret;
			}

			if (data.namespace === WsNamespace.Chat) {
				switch (data.action) {
					case ChatAction.Join:
						return this.logger.verbose(
							`${user_uuid} JOIN channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Leave:
						return this.logger.verbose(
							`${user_uuid} LEAVE channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Send:
						return this.logger.verbose(
							`New message in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Delete:
						return this.logger.verbose(
							`Deleted message id ${
								data.uuid
							} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Remove:
						return this.logger.verbose(
							`Removed channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Promote:
						return this.logger.verbose(
							`Promoted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Demote:
						return this.logger.verbose(
							`Demoted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Ban:
						return this.logger.verbose(
							`Banned ${user_uuid} in channel ${channel_uuid} ${
								data.expiration ? 'until ' + data.expiration : 'permanently'
							} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
						);
					case ChatAction.Unban:
						return this.logger.verbose(
							`Unbanned ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Mute:
						return this.logger.verbose(
							`Muted ${user_uuid} in channel ${channel_uuid} ${
								data.expiration ? 'until ' + data.expiration : 'permanently'
							} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
						);
					case ChatAction.Unmute:
						return this.logger.verbose(
							`Unmuted ${user_uuid} in channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Avatar:
						this.logger.verbose(
							`Updated channel avatar for channel ${
								data.channel
							} dispatched to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
				}
			}
		},
		lobby: (
			lobby: GamesLobby,
			data:
				| WsGameJoin
				| WsGameInvite
				| WsGameLeave
				| WsGameReady
				| WsGameSpectate
				| WsGameStart
		) => {
			let i: number | null = 0;
			const spectators = lobby.spectators ? lobby.spectators.map((u) => u.uuid) : [];
			const users = [lobby.player1.uuid, lobby.player2?.uuid, ...spectators];

			for (const uuid of users) {
				if (!this.subscribed[uuid]) {
					continue;
				}

				for (const client of this.subscribed[uuid]) {
					if (client.lobby_uuid !== lobby.uuid) {
						continue;
					}

					this.logger.set(client.uuid);
					const ret = this.send(client, data);
					this.logger.unset();
					if (ret === false) {
						continue;
					}

					i++;
				}
			}

			switch (data.action) {
				case GameAction.Join:
					return this.logger.verbose(
						`${data.user_uuid} JOIN lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
				case GameAction.Invite:
					return this.logger.verbose(
						`${data.user_uuid} INVITED lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
				case GameAction.Leave:
					return this.logger.verbose(
						`${data.user_uuid} LEAVE lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
				case GameAction.Spectate:
					return this.logger.verbose(
						`${data.user_uuid} SPECTATE lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
				case GameAction.Ready:
					return this.logger.verbose(
						`Player ${data.user_uuid} is ready for lobby ${
							lobby.uuid
						} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
				case GameAction.Start:
					return this.logger.verbose(
						`Game for lobby ${
							lobby.uuid
						} has started broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
					);
			}
		}
	};

	async connected(client: WebSocketUser) {
		const user_uuid = client.jwt.infos.uuid;
		if (!this.subscribed) {
			this.subscribed;
		}

		if (!this.subscribed[user_uuid]) {
			const channels = await this.channelRepository
				.find({
					select: { uuid: true },
					where: { users: { uuid: user_uuid } }
				})
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.error('Cannot get channels', e);
					throw new InternalServerErrorException();
				});

			this.subscribed[user_uuid] = [];
			this.subscribed[user_uuid].push(client);
			this.logger.verbose('Connected ' + user_uuid);

			const len = channels ? channels.length : 0;
			if (len) {
				this.logger.verbose(
					`Subscribed to ${len != 1 ? 'channels' : 'channel'} ${JSON.stringify(
						channels.map((c) => c.uuid)
					)}`
				);
			} else {
				this.logger.verbose('Not subscribed to any channel');
			}
		} else {
			this.subscribed[user_uuid].push(client);
			this.logger.verbose('Connected ' + user_uuid);
		}
	}

	disconnected(client: WebSocketUser) {
		const user_uuid = client.jwt.infos.uuid;

		this.lobbyService.removeFromLobbies(client.jwt);

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
