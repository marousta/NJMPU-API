import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, WebSocket } from 'ws';

import { ChatsChannels } from '../chats/entities/channels.entity';

import { peerOrPeers as PeerOrPeers } from '../utils';

import {
	ChatAction,
	SubscribedChannels,
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
	WsUserUpdateSession
} from './types';

@Injectable()
export class WsService {
	private readonly logger = new Logger(WsService.name);
	public ws: Server = null;
	public subscribed_channels: SubscribedChannels;

	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>
	) {}

	/**
	 * Utils
	 */
	//#region  Utils
	private tokenHasExpired(exp: number) {
		return exp * 1000 < new Date().valueOf();
	}

	private send(client: WebSocket, data: any) {
		if (this.tokenHasExpired(client['refresh_token_exp'])) {
			const expired: WsUserExpired = {
				namespace: WsNamespace.User,
				action: UserAction.Expired
			};
			client.send(JSON.stringify(expired));
			this.logger.verbose(`Token for client with user ${client['user'].uuid} has expired`);
			return false;
		}

		client.send(JSON.stringify(data));
		return true;
	}

	/**
	 * Serivce
	 */
	//#region  Service
	public readonly subscribe = {
		channel: (user_uuid: string, channel_uuid: string) => {
			if (!this.subscribed_channels || !this.subscribed_channels[user_uuid]) {
				this.subscribed_channels = {
					...this.subscribed_channels,
					[user_uuid]: [channel_uuid]
				};
			} else {
				this.subscribed_channels[user_uuid].push(channel_uuid);
			}
		}
	};

	public readonly unsubscribe = {
		channel: (user_uuid: string, channel_uuid: string) => {
			if (this.subscribed_channels && this.subscribed_channels[user_uuid]) {
				this.subscribed_channels[user_uuid] = this.subscribed_channels[user_uuid].filter(
					(c) => c !== channel_uuid
				);
			}
		}
	};

	public readonly dispatch = {
		all: (data: WsChatCreate | WsChatRemove | WsChatAvatar | WsUserAvatar) => {
			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				i += this.send(c, data) ? 1 : 0;
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
			}
			if (data.namespace === WsNamespace.User) {
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
		) => {
			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				if (c['user'].uuid === uuid) {
					i += this.send(c, data) ? 1 : 0;
				}
			}

			if (data.namespace === WsNamespace.Chat) {
				this.logger.verbose(
					`Created direct channel ${
						data.channel
					} dispatched to ${i} connected ${PeerOrPeers(i)}`
				);
			}
			if (data.namespace === WsNamespace.User) {
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
				}
			}
		},
		channel: (
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

			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				if (this.subscribed_channels[c['user'].uuid]?.includes(channel_uuid)) {
					i += this.send(c, data) ? 1 : 0;
				}
			}
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
								data.id
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

	async connected(uuid: string) {
		if (!this.subscribed_channels || !this.subscribed_channels[uuid]) {
			const channels = await this.channelRepository
				.find({
					select: { uuid: true },
					where: { users: { uuid } }
				})
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.error('Cannot get channels', e);
					throw new InternalServerErrorException();
				});

			let subscribed: string[] = [];
			if (channels) {
				for (const c of channels) {
					subscribed.push(c.uuid);
				}
			}

			this.subscribed_channels = {
				...this.subscribed_channels,
				[uuid]: subscribed
			};
			this.logger.verbose('Connected ' + uuid);

			const len = this.subscribed_channels[uuid].length;
			if (len) {
				this.logger.verbose(
					`Subscribed to ${len != 1 ? 'channels' : 'channel'}`,
					this.subscribed_channels[uuid]
				);
			} else {
				this.logger.verbose('Not subscribed to any channel');
			}
		} else {
			this.logger.verbose('Connected ' + uuid);
		}
	}

	disconnected(uuid: string) {
		if (this.subscribed_channels && this.subscribed_channels[uuid]) {
			delete this.subscribed_channels[uuid];
			this.logger.verbose('No more connected client with user ' + uuid);
		}
		this.logger.verbose('Disconnected ' + uuid);
	}
	//#endregion
}
