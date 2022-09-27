import {
	Injectable,
	Logger,
	InternalServerErrorException,
	UnauthorizedException,
	BadRequestException,
	NotFoundException,
	ForbiddenException,
	Inject,
	forwardRef
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
	ChannelDirectGetResponse,
	ChannelData,
	DirectData
} from '../properties/channels.get.property';

import { isEmpty, genIdentifier } from '../../utils';

import { ChannelType, ChatsDirect, ChatsGroupPrivate, ChatsGroupPublic } from '../types';
import { WsNamespace, ChatAction } from '../../websockets/types';

@Injectable()
export class ChannelsService {
	private readonly logger = new Logger(ChannelsService.name);
	constructor(
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		@Inject(forwardRef(() => MessagesService))
		private readonly messagesService: MessagesService,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	//#region  Utils
	private async findOneByRelationOrNull(channel_uuid: string): Promise<ChatsChannels | null> {
		return await this.channelRepository
			.findOneOrFail({
				where: { uuid: channel_uuid },
				relations: ['users', 'moderator']
			})
			.catch((e) => {
				return null;
			});
	}

	private async findOneBy(uuid: string): Promise<ChatsChannels> {
		return await this.channelRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.error('Channel not found ' + uuid, e);
			throw new InternalServerErrorException();
		});
	}

	private async findOneUserBy(uuid: string): Promise<UsersInfos> {
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
	})(this);

	//  prettier-ignore
	private validateChannelType(params: ChannelsCreateProperty): ChatsGroupPublic | ChatsGroupPrivate | ChatsDirect {
		if ((params.current_user_uuid // Join channel public request
			&& params.channel_uuid
			&& !params.type
			&& !params.identifier
			&& !params.name
			&& !params.user_uuid)
		|| (params.type === ChannelType.Public // Create channel public request
			&& params.current_user_uuid
			&& params.name
			&& !params.identifier
			&& !params.channel_uuid
			&& !params.user_uuid))
		{
			return {
				type: ChannelType.Public,
				name: params.name,
				password: params.password,
				current_user_uuid: params.current_user_uuid,
				channel_uuid: params.channel_uuid
			}
		}
		if ((params.identifier // Join private channel request
			&& params.name
			&& params.password
			&& params.current_user_uuid
			&& !params.channel_uuid
			&& !params.user_uuid)
		|| (params.type === ChannelType.Private // Create private channel request
			&& params.name
			&& params.password
			&& params.current_user_uuid
			&& !params.channel_uuid
			&& !params.user_uuid))
		{
			return {
				type: ChannelType.Private,
				identifier: params.identifier,
				name: params.name,
				password: params.password,
				current_user_uuid: params.current_user_uuid,
				channel_uuid: params.channel_uuid
			}
		}
		if (params.current_user_uuid  // Create direct channel request
		&& params.user_uuid
		&& !params.type
		&& !params.identifier
		&& !params.name
		&& !params.password
		&& !params.channel_uuid)
		{
			return {
				type: ChannelType.Direct,
				current_user_uuid: params.current_user_uuid,
				user_uuid: params.user_uuid
			}
		}
		throw new BadRequestException('Unable to determine channel type')
	}

	async userInChannelFind(channel_uuid: string, user_uuid: string): Promise<boolean> {
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

	userInChannel(channel: ChatsChannels, user_uuid: string) {
		for (const u of channel.users) {
			if (u.uuid === user_uuid) {
				return true;
			}
		}
		return false;
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
			.createQueryBuilder('channels')
			.where({ type: ChannelType.Public })
			.orderBy('name', 'ASC')
			.orderBy('identifier', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadAllRelationIds()
			.getManyAndCount();

		let data: ChannelData[] = [];
		for (const channel of ret[0]) {
			const { uuid, type, identifier, name, password, moderator, users } = channel;
			const message_count = await this.messagesService.count(channel.uuid);
			data.push({
				uuid,
				type,
				identifier,
				name,
				password: password !== null,
				message_count,
				moderator: moderator as any as string,
				users: users as any as string[]
			});
		}
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async getAllin(
		uuid: string,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<ChannelsGetResponse> {
		if (page === 0) {
			page = 1;
		}
		const ret = await this.channelRepository
			.createQueryBuilder('channels')
			.leftJoin('channels.users', 'users')
			.where('users.uuid = :uuid ', {
				uuid
			})
			.orderBy('channels.name', 'ASC')
			.orderBy('channels.identifier', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadAllRelationIds()
			.getManyAndCount();

		let data: Array<ChannelData | DirectData> = [];
		for (const channel of ret[0]) {
			const message_count = await this.messagesService.count(channel.uuid);
			const { uuid, type, identifier, name, password, moderator, users } = channel;

			if (channel.type === ChannelType.Direct) {
				data.push({
					uuid,
					type,
					message_count,
					users: users as any as string[]
				});
			} else {
				data.push({
					uuid,
					type,
					identifier,
					name,
					message_count,
					moderator: moderator as any as string,
					password: password !== null,
					users: users as any as string[]
				});
			}
		}
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async getOne(
		channel_uuid: string,
		user_uuid: string
	): Promise<ChannelGetResponse | ChannelDirectGetResponse> {
		const channel = await this.findOneByRelationOrNull(channel_uuid);
		// prettier-ignore
		if (!channel || (channel.type === ChannelType.Private && !this.userInChannel(channel, user_uuid))) {
			throw new NotFoundException();
		}
		const { uuid, type, identifier, name, password, moderator, users } = channel;

		const message_count = await this.messagesService.count(channel_uuid);
		let filteredUsers: string[] = [];
		for (const u of users) {
			filteredUsers.push(u.uuid);
		}

		if (type === ChannelType.Direct) {
			return {
				uuid,
				type,
				message_count,
				users: filteredUsers
			};
		} else {
			return {
				uuid,
				type,
				identifier,
				name,
				message_count,
				moderator: moderator as any as string,
				password: password !== null,
				users: filteredUsers
			};
		}
	}

	private readonly create = {
		channel: async (params: ChatsGroupPublic | ChatsGroupPrivate) => {
			// Get user
			const user = await this.usersRepository
				.findOneByOrFail({ uuid: params.current_user_uuid })
				.catch((e) => {
					// Should never happen
					this.logger.error('Unable to find user ' + params.current_user_uuid, e);
					throw new UnauthorizedException();
				});

			// Generate identifier
			const channels = await this.channelRepository
				.findBy({ name: params.name })
				.catch((e) => {
					this.logger.error(`Unable to find channels`, e);
					return null;
				})
				.then((r) => (r.length ? r : null));
			let exclude: number[] = [];
			let identifier: number;
			if (channels) {
				for (const c of channels) {
					exclude.push(c.identifier);
				}
			}
			identifier = genIdentifier(exclude);

			// Hash password
			let password = null;
			if (!isEmpty(params.password)) {
				password = await argon2.hash(params.password, {
					timeCost: 11,
					saltLength: 128
				});
			}

			// Save to database
			const request = this.channelRepository.create({
				type: params.type,
				identifier,
				name: params.name,
				password,
				moderator: user
			});
			request.addUser(user);
			const new_channel = await this.channelRepository.save(request).catch((e) => {
				this.logger.error('Unable to create channel', e);
				throw new InternalServerErrorException();
			});

			// Dispatch created message
			if (new_channel.type === ChannelType.Public) {
				this.wsService.dispatch.all({
					namespace: WsNamespace.Chat,
					action: ChatAction.Create,
					channel: new_channel.uuid
				});
			}

			// Subscribe user to channel
			this.wsService.subscribe.channel(user.uuid, new_channel.uuid);

			// Dispatch joined message
			this.wsService.dispatch.channel({
				namespace: WsNamespace.Chat,
				action: ChatAction.Join,
				channel: new_channel.uuid,
				user: user.uuid
			});

			return {
				uuid: new_channel.uuid
			};
		},
		direct: async (params: ChatsDirect) => {
			if (params.current_user_uuid === params.user_uuid) {
				throw new BadRequestException("You can't DM yourself");
			}

			// Get current user
			// should not fail
			const current_user = await this.usersRepository
				.findOneByOrFail({ uuid: params.current_user_uuid })
				.catch((e) => {
					this.logger.error('Unable to find current user ' + params.current_user_uuid, e);
					throw new UnauthorizedException();
				});

			// Get remote user
			const remote_user = await this.usersRepository
				.findOneByOrFail({ uuid: params.user_uuid })
				.catch((e) => {
					this.logger.error('Unable to find relatiom user ' + params.user_uuid, e);
					throw new NotFoundException("User doesn't exist");
				});

			const name = current_user.uuid + '+' + remote_user.uuid;
			const rev_name = remote_user.uuid + '+' + current_user.uuid;

			// Check if already exist
			const exist = await this.channelRepository
				.createQueryBuilder()
				.where({ name })
				.orWhere({ name: rev_name })
				.getMany()
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.verbose("Direct channel doesn't exist yet", e);
					return null;
				});
			if (exist) {
				throw new BadRequestException('Direct message with this user already exist');
			}

			// Save to database
			const request = this.channelRepository.create({
				type: params.type,
				identifier: 0,
				name
			});
			request.addUser(current_user);
			request.addUser(remote_user);
			const new_direct = await this.channelRepository.save(request).catch((e) => {
				this.logger.error('Unable to create channel', e);
				throw new InternalServerErrorException();
			});

			// Subscribe user to channel
			this.wsService.subscribe.channel(current_user.uuid, new_direct.uuid);
			this.wsService.subscribe.channel(remote_user.uuid, new_direct.uuid);

			// Dispatch joined message
			this.wsService.dispatch.user(current_user.uuid, {
				namespace: WsNamespace.Chat,
				action: ChatAction.Create,
				channel: new_direct.uuid
			});
			this.wsService.dispatch.user(remote_user.uuid, {
				namespace: WsNamespace.Chat,
				action: ChatAction.Create,
				channel: new_direct.uuid
			});

			return {
				uuid: new_direct.uuid
			};
		}
	};

	async join(params: ChannelsCreateProperty) {
		const parsed = this.validateChannelType(params);

		// is direct create request
		if (parsed.type === ChannelType.Direct) {
			return await this.create.direct(parsed); // Return channel uuid
		}

		let channel: ChatsChannels;
		if (parsed.type === ChannelType.Public) {
			// is channel public create request
			if (isEmpty(parsed.channel_uuid)) {
				return await this.create.channel(parsed); // Return channel uuid
			}
			// is channel public join request
			else {
				channel = await this.channelRepository
					.findOneOrFail({ where: { uuid: parsed.channel_uuid }, relations: ['users'] })
					.catch((e) => {
						this.logger.verbose(
							`Unable to find public channel ${parsed.channel_uuid}`,
							e
						);
						return null;
					});
			}
		}

		if (parsed.type === ChannelType.Private) {
			// is channel private create request
			if (parsed.identifier === undefined) {
				return await this.create.channel(parsed); // Return channel uuid
			}
			// is channel private join request
			else {
				channel = await this.channelRepository
					.findOneOrFail({
						where: { identifier: parsed.identifier, name: parsed.name },
						relations: ['users']
					})
					.catch((e) => {
						this.logger.verbose(
							`Unable to find private channel ${parsed.name}#${parsed.identifier}`,
							e
						);
						return null;
					});
			}
		}

		if (!channel || channel.type === ChannelType.Direct) {
			throw new NotFoundException("Channel doesn't exist");
		}
		if (this.userInChannel(channel, parsed.current_user_uuid)) {
			throw new BadRequestException("You're already in this channel");
		}

		// Channel has password
		if (channel.password) {
			if (isEmpty(parsed.password)) {
				throw new BadRequestException('Wrong password');
			}
			const verif = await argon2.verify(channel.password, parsed.password);
			if (!verif) {
				throw new BadRequestException('Wrong password');
			}
		}

		// Update database relation
		const { channelObj, userObj } = await this.update.channel(
			channel,
			parsed.current_user_uuid
		);

		// Subscribe user to channel
		this.wsService.subscribe.channel(userObj.uuid, channelObj.uuid);

		// Dispatch user joined to all members of channel
		this.wsService.dispatch.channel({
			namespace: WsNamespace.Chat,
			action: ChatAction.Join,
			channel: channelObj.uuid,
			user: userObj.uuid
		});
	}

	async leave(channel_uuid: string, user_uuid: string) {
		const channel = await this.findOneByRelationOrNull(channel_uuid);
		if (!channel) {
			throw new NotFoundException();
		}

		if (channel.type === ChannelType.Direct) {
			throw new BadRequestException("You can't leave direct channel");
		}

		if (!this.userInChannel(channel, user_uuid)) {
			throw new ForbiddenException("You're not in this channel");
		}

		channel.users = channel.users.filter((user) => user.uuid !== user_uuid);

		if (!channel.users.length) {
			await this.channelRepository.delete(channel.uuid);
		} else {
			await this.channelRepository.save(channel);
		}

		this.wsService.dispatch.channel({
			namespace: WsNamespace.Chat,
			action: ChatAction.Leave,
			channel: channel_uuid,
			user: user_uuid
		});
		this.wsService.unsubscribe.channel(user_uuid, channel_uuid);
	}
	//#endregion
}
