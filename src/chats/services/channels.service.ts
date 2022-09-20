import {
	Injectable,
	Logger,
	InternalServerErrorException,
	UnauthorizedException,
	BadRequestException,
	NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { MessagesService } from './messages.service';
import { WsService } from '../../websockets/ws.service';

import { ChatsChannels } from '../entities/channels.entity';
import { UsersInfos } from '../../users/users.entity';

import { ChannelsCreateProperty } from '../properties/channels.create.property';
import {
	ChannelsGetResponse,
	ChannelGetResponse,
	ChannelData
} from '../properties/channels.get.property';

import { isEmpty, genIdentifier } from '../../utils';

import {
	DispatchChannelLeave,
	ChatState,
	DispatchChannelJoin,
	WsEvents
} from '../../websockets/types';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);
	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly messagesService: MessagesService,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	//#region  Utils
	private async findOneOrNull(uuid: string): Promise<ChatsChannels | null> {
		return await this.channelRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.error('Unable to find ' + uuid, e);
			return null;
		});
	}

	private async findByOrNUll(req: object): Promise<ChatsChannels[] | null> {
		const params = Object.keys(req)[0];
		const value = Object.values(req)[0];
		return await this.channelRepository
			.findBy({ [params]: value })
			.catch((e) => {
				this.logger.error(`Unable to find channels ${params}: ${value}`, e);
				return null;
			})
			.then((r) => (r.length ? r : null));
	}

	private async findOneByRelationOrNull(channel_uuid: string): Promise<ChatsChannels | null> {
		return await this.channelRepository
			.findOneOrFail({
				where: { uuid: channel_uuid },
				relations: ['users']
			})
			.catch((e) => {
				return null;
			});
	}

	async findOneBy(uuid: string): Promise<ChatsChannels> {
		return await this.channelRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.error('Channel not found ' + uuid, e);
			throw new InternalServerErrorException();
		});
	}

	async findOneUserBy(uuid: string): Promise<UsersInfos> {
		return await this.usersRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.error('User not found ' + uuid, e);
			throw new InternalServerErrorException();
		});
	}

	private readonly update = new (class {
		constructor(private readonly service: ChannelsService) {}

		private async parseArgs(
			channel: ChatsChannels | string,
			user: UsersInfos | string
		): Promise<{ channelObj: ChatsChannels; userObj: UsersInfos }> {
			let channelObj: ChatsChannels;
			let userObj: UsersInfos;
			if (typeof channel === 'string') {
				channelObj = await this.service.findOneBy(channel);
			} else {
				channelObj = channel;
			}
			if (typeof user === 'string') {
				userObj = await this.service.findOneUserBy(user);
			} else {
				userObj = user;
			}

			return { channelObj, userObj };
		}

		async channel(
			channel: ChatsChannels | string,
			user: UsersInfos | string
		): Promise<{ channelObj: ChatsChannels; userObj: UsersInfos }> {
			const { channelObj, userObj } = await this.parseArgs(channel, user);
			channelObj.addUser(userObj);
			await this.service.channelRepository.save(channelObj).catch((e) => {
				this.service.logger.error(
					'Unable to update channel users list ' + channelObj.uuid,
					e
				);
				throw new InternalServerErrorException();
			});
			return { channelObj, userObj };
		}

		async user(
			channel: ChatsChannels | string,
			user: UsersInfos | string
		): Promise<{ channelObj: ChatsChannels; userObj: UsersInfos }> {
			const { channelObj, userObj } = await this.parseArgs(channel, user);

			userObj.addChannel(channelObj);
			await this.service.usersRepository.save(userObj).catch((e) => {
				this.service.logger.error('Unable to update user channels list ' + userObj.uuid, e);
				throw new InternalServerErrorException();
			});
			return { channelObj, userObj };
		}
	})(this);

	async userInChannel(channel_uuid: string, user_uuid: string): Promise<boolean> {
		return await this.channelRepository
			.findOneOrFail({
				where: {
					uuid: channel_uuid,
					users: {
						uuid: user_uuid
					}
				},
				relations: ['users']
			})
			.then((c) => true)
			.catch((e) => false);
	}
	//#endregion

	/**
	 * Serivce
	 */
	//#region  Service
	async getAll(
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<ChannelsGetResponse> {
		if (page === 0) {
			page = 1;
		}
		const ret = await this.channelRepository
			.createQueryBuilder()
			.orderBy('name', 'ASC')
			.orderBy('identifier', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadAllRelationIds({ relations: ['users'] })
			.getManyAndCount();
		let data: ChannelData[] = [];
		for (const channel of ret[0]) {
			const { users, user, ...filtered } = channel;
			const message_count = await this.messagesService.count(channel.uuid);
			data.push({
				...filtered,
				users: users as any as string[],
				message_count,
				password: channel.password !== null
			});
		}
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async getOne(channel_uuid: string): Promise<ChannelGetResponse> {
		const channel = await this.findOneByRelationOrNull(channel_uuid);
		if (!channel) {
			throw new NotFoundException();
		}
		const message_count = await this.messagesService.count(channel_uuid);
		const filteredUsers = channel.users.map((user) => user.uuid);
		const { users, ...filtered } = channel;
		return {
			...filtered,
			users: filteredUsers,
			message_count,
			password: channel.password !== null
		};
	}

	async create(params: ChannelsCreateProperty) {
		const user = await this.usersRepository
			.findOneByOrFail({ uuid: params.user_uuid })
			.catch((e) => {
				this.logger.error('Unable to find user ' + params.user_uuid, e);
				throw new UnauthorizedException();
			});

		const channels = await this.findByOrNUll({ name: params.name });
		let exclude: number[] = [];
		let identifier: number;
		if (channels) {
			exclude = channels.map((c: ChatsChannels) => c.identifier);
		}
		identifier = genIdentifier(exclude);

		let password = null;
		if (!isEmpty(params.password)) {
			password = await argon2.hash(params.password, {
				timeCost: 11,
				saltLength: 128
			});
		}

		const request = this.channelRepository.create({
			identifier,
			name: params.name,
			password
		});
		request.addUser(user);
		const new_channel = await this.channelRepository.save(request).catch((e) => {
			this.logger.error('Unable to create channel', e);
			throw new InternalServerErrorException();
		});
		await this.update.user(new_channel, user);

		// Dispatch created message
		this.wsService.dispatch.all({
			event: WsEvents.Chat,
			state: ChatState.Create,
			channel: new_channel.uuid
		});
		// Dispatch joined message
		this.wsService.subscribe.channel(user.uuid, new_channel.uuid);
		this.wsService.dispatch.channel({
			event: WsEvents.Chat,
			state: ChatState.Join,
			channel: new_channel.uuid,
			user: user.uuid
		});

		return {
			uuid: new_channel.uuid
		};
	}

	async join(params: ChannelsCreateProperty) {
		if (isEmpty(params.channel_uuid)) {
			// Return channel uuid
			return await this.create(params);
		}
		// Needs channel uuid
		const channel = await this.findOneOrNull(params.channel_uuid);

		if (!channel) {
			throw new NotFoundException();
		}

		if (channel.password) {
			if (isEmpty(params.password)) {
				throw new BadRequestException();
			}
			const verif = await argon2.verify(channel.password, params.password);
			if (!verif) {
				throw new BadRequestException();
			}
		}

		const { channelObj, userObj } = await this.update.channel(channel, params.user_uuid);
		await this.update.user(channelObj, userObj);
		// TODO: Dispatch joined message
		const data: DispatchChannelJoin = {
			event: WsEvents.Chat,
			state: ChatState.Join,
			channel: channelObj.uuid,
			user: userObj.uuid
		};
		this.wsService.dispatch.channel(data);
	}

	async leave(channel_uuid: string, user_uuid: string) {
		const channel = await this.findOneByRelationOrNull(channel_uuid);
		if (!channel) {
			throw new NotFoundException();
		}

		channel.users = channel.users.filter((user) => user.uuid !== user_uuid);

		if (!channel.users.length) {
			await this.channelRepository.delete(channel.uuid);
		} else {
			await this.channelRepository.save(channel);
		}
		// TODO: Dispatch unsubscibre message
		const data: DispatchChannelLeave = {
			event: WsEvents.Chat,
			state: ChatState.Leave,
			channel: channel_uuid,
			user: user_uuid
		};
		this.wsService.dispatch.channel(data);
		this.wsService.unsubscribe.channel(user_uuid, channel_uuid);
	}
	//#endregion
}
