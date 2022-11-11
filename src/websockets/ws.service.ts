import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'ws';

import { ChatsChannels } from '../chats/entities/channels.entity';

import { peerOrPeers as PeerOrPeers } from '../utils';

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
	WsUserUnfriend
} from './types';

@Injectable()
export class WsService {
	private readonly logger = new Logger(WsService.name);
	public ws: Server = null;
	private subscribed: SubscribedDictionary = {};

	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>
	) {}

	/**
	 * Utils
	 */
	//#region

	private tokenHasExpired(exp: number) {
		return exp * 1000 < new Date().valueOf();
	}

	private send(client: WebSocketUser, data: any) {
		if (this.tokenHasExpired(client.refresh_token_exp)) {
			this.logger.warn(client.refresh_token_exp * 1000, new Date().valueOf());
			const expired: WsUserExpired = {
				namespace: WsNamespace.User,
				action: UserAction.Expired
			};
			client.send(JSON.stringify(expired));
			this.logger.verbose(`Token for client with user ${client.user.uuid} has expired`);
			return false;
		}

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
				| WsUserNotification
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
						this.logger.verbose(
							`New notification for ${uuid} broadcasted to ${i} connected ${PeerOrPeers(
								i
							)}`
						);
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
							`Readed notification ${
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
			users.forEach((uuid) => {
				if (!this.subscribed[uuid]) {
					return;
				}

				const ret = this.processSend(uuid, data);

				if (ret === null) {
					return;
				} else if (ret === 0) {
					this.logger.warn(
						'Websocket tried to send data on empty user, this should not happend'
					);
					return;
				}

				i += ret;
			});

			if (data.namespace === WsNamespace.Chat) {
				switch (data.action) {
					case ChatAction.Join:
						return this.logger.verbose(
							`${user_uuid} JOIN ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Leave:
						return this.logger.verbose(
							`${user_uuid} LEAVE ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Send:
						return this.logger.verbose(
							`New message in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Delete:
						return this.logger.verbose(
							`Deleted message id ${
								data.uuid
							} in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
						);
					case ChatAction.Remove:
						return this.logger.verbose(
							`Removed channel ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Promote:
						return this.logger.verbose(
							`Promoted ${user_uuid} in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Demote:
						return this.logger.verbose(
							`Demoted ${user_uuid} in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Ban:
						return this.logger.verbose(
							`Banned ${user_uuid} in ${channel_uuid} ${
								data.expiration ? 'until ' + data.expiration : 'permanently'
							} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
						);
					case ChatAction.Unban:
						return this.logger.verbose(
							`Unbanned ${user_uuid} in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Mute:
						return this.logger.verbose(
							`Muted ${user_uuid} in ${channel_uuid} ${
								data.expiration ? 'until ' + data.expiration : 'permanently'
							} broadcasted to ${i} subscribed ${PeerOrPeers(i)}`
						);
					case ChatAction.Unmute:
						return this.logger.verbose(
							`Unmuted ${user_uuid} in ${channel_uuid} broadcasted to ${i} subscribed ${PeerOrPeers(
								i
							)}`
						);
					case ChatAction.Avatar:
						this.logger.verbose(
							`Updated channel avatar for ${
								data.channel
							} dispatched to ${i} connected ${PeerOrPeers(i)}`
						);
						break;
				}
			}
		}
	};

	async connected(client: WebSocketUser) {
		const user_uuid = client.user.uuid;

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
		const user_uuid = client.user.uuid;

		// Check if user is subscribed
		if (user_uuid && this.subscribed && this.subscribed[user_uuid]) {
			// Remove client
			this.subscribed[user_uuid].forEach((c, i) => {
				if (c.uuid === client.uuid) {
					delete this.subscribed[user_uuid][i];
				}
				if (!i) {
					this.subscribed[user_uuid] = [];
				}
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
