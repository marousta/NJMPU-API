import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, WebSocket } from 'ws';

import { DispatchSessionDestroyed, DispatchChannelCreate } from './types';
import { ChatsChannels } from '../chats/entities/channels.entity';

import {
	SubscribedChannels,
	DispatchChannelJoin,
	DispatchChannelLeave,
	DispatchChannelSend,
	DispatchChannelDelete,
	ChatState,
	WsEvents
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
	wsHasUUID(uuid: string) {
		const client = this.ws.clients.values();
		let c = null;
		while ((c = client.next().value)) {
			if (c['user_uuid'] === uuid) {
				return true;
			}
		}
		return false;
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
			if (this.subscribed_channels[user_uuid]) {
				this.subscribed_channels[user_uuid] = this.subscribed_channels[user_uuid].filter(
					(c) => c !== channel_uuid
				);
			}
		}
	};

	public readonly dispatch = {
		all: (data: DispatchChannelCreate) => {
			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				c.send(JSON.stringify(data));
				++i;
			}
			if (data.event === WsEvents.Chat) {
				this.logger.verbose(
					`Created channel ${data.channel} dispatched to ${i} connected ${
						i != 1 ? 'peers' : 'peer'
					}`
				);
			}
		},
		user: (uuid: string, data: DispatchChannelCreate | DispatchSessionDestroyed) => {
			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				if (c['user_uuid'] === uuid) {
					c.send(JSON.stringify(data));
					++i;
				}
			}

			if (data.event === WsEvents.Chat) {
				this.logger.verbose(
					`Created direct channel ${data.channel} dispatched to ${i} connected ${
						i != 1 ? 'peers' : 'peer'
					}`
				);
			}
			if (data.event === WsEvents.Session) {
				this.logger.verbose(
					`Token recheck forced on ${uuid} for ${i} connected ${
						i != 1 ? 'peers' : 'peer'
					}`
				);
			}
		},
		channel: (
			data:
				| DispatchChannelJoin
				| DispatchChannelLeave
				| DispatchChannelSend
				| DispatchChannelDelete
		) => {
			const user_uuid = data.user;
			const channel_uuid = data.channel;

			const client = this.ws.clients.values();
			let c: WebSocket = null;
			let i = 0;
			while ((c = client.next().value)) {
				if (this.subscribed_channels[c['user_uuid']]?.includes(channel_uuid)) {
					c.send(JSON.stringify(data));
					++i;
				}
			}
			if (data.event === WsEvents.Chat) {
				switch (data.state) {
					case ChatState.Join:
						return this.logger.verbose(
							`${user_uuid} JOIN ${channel_uuid} brodcasted to ${i} subscribed ${
								i != 1 ? 'peers' : 'peer'
							}`
						);
					case ChatState.Leave:
						return this.logger.verbose(
							`${user_uuid} LEAVE ${channel_uuid} brodcasted to ${i} subscribed ${
								i != 1 ? 'peers' : 'peer'
							}`
						);
					case ChatState.Send:
						return this.logger.verbose(
							`New message in ${channel_uuid} brodcasted to ${i} subscribed ${
								i != 1 ? 'peers' : 'peer'
							}`
						);
					case ChatState.Delete:
						return this.logger.verbose(
							`Deleted message id ${
								data.id
							} in ${channel_uuid} brodcasted to ${i} subscribed ${
								i != 1 ? 'peers' : 'peer'
							}`
						);
				}
			}
		}
	};

	async connected(uuid: string) {
		if (!this.subscribed_channels || !this.subscribed_channels[uuid]) {
			const channels = await this.channelRepository
				.find({
					where: { users: { uuid } }
				})
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.error('Cannot get channels', e);
					throw new InternalServerErrorException();
				});

			let subscribed: string[] = [];
			for (const c of channels) {
				subscribed.push(c.uuid);
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
				this.logger.verbose('Not subscribed to any channels');
			}
		} else {
			this.logger.verbose('Connected ' + uuid);
		}
	}

	disconnected(uuid: string) {
		if (this.wsHasUUID(uuid)) {
			return;
		}
		if (this.subscribed_channels && this.subscribed_channels[uuid]) {
			delete this.subscribed_channels[uuid];
			this.logger.verbose('No more connected client with user ' + uuid);
		}
		this.logger.verbose('Disconnected ' + uuid);
	}
	//#endregion
}
