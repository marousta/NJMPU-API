import {
	Injectable,
	Logger,
	InternalServerErrorException,
	BadRequestException,
	NotFoundException,
	ForbiddenException,
	Inject,
	forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';

import { ChannelsBlacklistService } from './channels.blacklist.service';
import { MessagesService } from './messages.service';
import { WsService } from '../../websockets/ws.service';

import { ChatsChannels, ChatsChannelsID } from '../entities/channels.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { ChannelsCreateProperty } from '../properties/channels.create.property';
import {
	ChannelsDataGetResponse,
	ChannelGetResponse,
	ChannelDirectGetResponse,
	ChannelData,
	DirectData,
	ChannelPrivateGetResponse
} from '../properties/channels.get.property';

import {
	ChannelModerationPropertyEX,
	ChannelSettingProperty
} from '../properties/channels.update.property';
import { ChannelLeaveProperty, LeaveAction } from '../properties/channels.delete.property';
import { BlacklistGetProperty } from '../properties/channels.blacklist.get.property';
import { ChannelPrivateProperty } from '../properties/channels.get.property';

import { hash_verify } from '../../auth/utils';
import { isEmpty, genIdentifier, dateFromOffset } from '../../utils';

import {
	ChannelType,
	ChatsDirect,
	ChatsGroupPrivate,
	ChatsGroupPublic,
	ApiResponseError
} from '../types';
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
		private readonly blacklistService: ChannelsBlacklistService,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	//#region  Utils
	readonly findOne = {
		WithRelationsID: async (channel_uuid: string): Promise<ChatsChannelsID> => {
			return await this.channelRepository
				.createQueryBuilder('channels')
				.where({ uuid: channel_uuid })
				.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
				.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
				.loadRelationIdAndMap('channels.usersID', 'channels.users')
				.getOneOrFail()
				.catch((e) => {
					this.logger.verbose('Unable to find channel ' + channel_uuid, e);
					throw new NotFoundException(ApiResponseError.ChannelNotFound);
				});
		},
		WithUsersAndRelationsID: async (
			where: object,
			error_msg: string
		): Promise<ChatsChannelsID> => {
			return await this.channelRepository
				.createQueryBuilder('channels')
				.where(where)
				.leftJoinAndSelect('channels.users', 'users')
				.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
				.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
				.loadRelationIdAndMap('channels.usersID', 'channels.users')
				.getOneOrFail()
				.catch((e) => {
					this.logger.verbose(error_msg, e);
					this.logger.verbose(where);
					throw new NotFoundException(ApiResponseError.ChannelNotFound);
				});
		},
		WithAllAndRelationsID: async (
			where: object,
			error_msg: string
		): Promise<ChatsChannelsID> => {
			return await this.channelRepository
				.createQueryBuilder('channels')
				.where(where)
				.leftJoinAndSelect('channels.users', 'users')
				.leftJoinAndSelect('channels.moderators', 'moderators')
				.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
				.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
				.loadRelationIdAndMap('channels.usersID', 'channels.users')
				.getOneOrFail()
				.catch((e) => {
					this.logger.verbose(error_msg, e);
					this.logger.verbose(where);
					throw new NotFoundException(ApiResponseError.ChannelNotFound);
				});
		},
		By: async (uuid: string) => {
			return await this.channelRepository.findOneByOrFail({ uuid }).catch((e) => {
				this.logger.error('Channel not found ' + uuid, e);
				throw new InternalServerErrorException();
			});
		}
	};

	private async save(channel: ChatsChannels, error_msg: string) {
		return await this.channelRepository.save(channel).catch((e) => {
			this.logger.error(error_msg, e);
			throw new InternalServerErrorException();
		});
	}

	private async updateRelation(channel: ChatsChannels, user: UsersInfos | string) {
		if (typeof user === 'string') {
			user = await this.usersRepository.findOneByOrFail({ uuid: user }).catch((e) => {
				this.logger.error('Unable to find user ' + user);
				throw new InternalServerErrorException();
			});
		}

		channel.addUser(user);
		channel = await this.save(channel, 'Unable to update channel users list ' + channel.uuid);

		return { channelObj: channel, userObj: user };
	}

	//  prettier-ignore
	private validateChannelType(params: ChannelsCreateProperty): ChatsGroupPublic | ChatsGroupPrivate | ChatsDirect {
		if ((params.current_user // Join channel public request
			&& params.channel_uuid
			&& !params.type
			&& !params.identifier
			&& !params.name
			&& !params.user_uuid)
		|| (params.type === ChannelType.Public // Create channel public request
			&& params.current_user
			&& params.name
			&& !params.identifier
			&& !params.channel_uuid
			&& !params.user_uuid))
		{
			return {
				type: ChannelType.Public,
				name: params.name,
				password: params.password,
				current_user: params.current_user,
				channel_uuid: params.channel_uuid
			}
		}
		if ((params.identifier // Join private channel request
			&& params.name
			&& params.password
			&& params.current_user
			&& !params.channel_uuid
			&& !params.user_uuid)
		|| (params.type === ChannelType.Private // Create private channel request
			&& params.name
			&& params.password
			&& params.current_user
			&& !params.channel_uuid
			&& !params.user_uuid))
		{
			return {
				type: ChannelType.Private,
				identifier: params.identifier,
				name: params.name,
				password: params.password,
				current_user: params.current_user,
				channel_uuid: params.channel_uuid
			}
		}
		if (params.current_user  // Create direct channel request
		&& params.user_uuid
		&& !params.type
		&& !params.identifier
		&& !params.name
		&& !params.password
		&& !params.channel_uuid)
		{
			return {
				type: ChannelType.Direct,
				current_user: params.current_user,
				user_uuid: params.user_uuid
			}
		}
		throw new BadRequestException('Unable to determine channel type')
	}

	private async getIdentifier(name: string) {
		while (true) {
			const channels = await this.channelRepository
				.find({
					select: { identifier: true },
					where: { name: name }
				})
				.catch((e) => {
					this.logger.error(`Unable to find channels`, e);
					return null;
				})
				.then((r) => (r.length ? r : null));
			const exclude: number[] = [];
			channels?.forEach((c) => exclude.push(c.identifier));

			const id = genIdentifier(exclude);
			if (id === null) {
				name += Math.floor(Math.random() * 10);
				continue;
			}
			return id;
		}
	}

	readonly user = {
		find500: async (user_uuid: string) => {
			return await this.usersRepository.findOneByOrFail({ uuid: user_uuid }).catch((e) => {
				this.logger.error('Unable to get user ' + user_uuid, e);
				throw new InternalServerErrorException();
			});
		},
		inChannelFind: async (channel_uuid: string, user_uuid: string): Promise<boolean> => {
			const channel = await this.findOne.WithRelationsID(channel_uuid);
			return this.user.inChannel(channel.usersID, user_uuid);
		},
		inChannel: (usersID: string[], user_uuid: string) => {
			if (!usersID) {
				throw new Error('Missing relationID for user.inChannel');
			}
			return usersID.includes(user_uuid);
		},
		isAdministrator: (administratorID: string, user_uuid: string) => {
			if (!administratorID) {
				return false;
				// throw new Error('Missing relationID for user.isAdministrator');
			}
			return administratorID === user_uuid;
		},
		isModerator: (moderatorsID: string[], user_uuid: string) => {
			if (!moderatorsID) {
				throw new Error('Missing relationID for user.isModerator');
			}
			return moderatorsID.includes(user_uuid);
		},
		hasPermissionsGet: async (channel_uuid: string, user_uuid: string) => {
			const channel = await this.findOne.WithAllAndRelationsID(
				{ uuid: channel_uuid },
				'Unable to find channel ' + channel_uuid
			);

			//  prettier-ignore
			if (channel.type === ChannelType.Direct
			|| !this.user.hasPermissions(channel, user_uuid)) {
				throw new ForbiddenException(ApiResponseError.NotAllowed);
			}

			return channel;
		},
		hasPermissions: (channel: ChatsChannelsID, user_uuid: string) => {
			//  prettier-ignore
			return (
				this.user.inChannel(channel.usersID, user_uuid)
				&& (this.user.isAdministrator(channel.administratorID, user_uuid) || this.user.isModerator(channel.moderatorsID, user_uuid))
			);
		}
	};
	//#endregion

	/**
	 * Serivce
	 */
	//#region  Service
	async getAll(
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<ChannelsDataGetResponse> {
		if (page === 0) {
			page = 1;
		}
		const ret: [ChatsChannelsID[], number] = await this.channelRepository
			.createQueryBuilder('channels')
			.where({ type: ChannelType.Public })
			.orderBy('name', 'ASC')
			.orderBy('identifier', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
			.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
			.loadRelationIdAndMap('channels.usersID', 'channels.users')
			.getManyAndCount();

		let data: ChannelData[] = [];
		for (const channel of ret[0]) {
			const message_count = await this.messagesService.count(channel.uuid);

			data.push({
				uuid: channel.uuid,
				default: channel.default,
				type: channel.type,
				identifier: channel.identifier,
				name: channel.name,
				password: channel.password !== null,
				avatar: channel.avatar,
				message_count,
				administrator: channel.administratorID,
				moderators: channel.moderatorsID,
				users: channel.usersID
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
	): Promise<ChannelsDataGetResponse> {
		if (page === 0) {
			page = 1;
		}
		const ret: [ChatsChannelsID[], number] = await this.channelRepository
			.createQueryBuilder('channels')
			.leftJoin('channels.users', 'users')
			.where('users.uuid = :uuid ', { uuid })
			.orderBy('channels.name', 'ASC')
			.orderBy('channels.identifier', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
			.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
			.loadRelationIdAndMap('channels.usersID', 'channels.users')
			.getManyAndCount();

		let count_primise: Promise<number>[] = [];
		for (const channel of ret[0]) {
			count_primise.push(this.messagesService.count(channel.uuid));
		}
		const messages_counts = await Promise.all(count_primise);

		let data: Array<ChannelData | DirectData> = [];
		for (const [i, channel] of ret[0].entries()) {
			const message_count = messages_counts[i];

			if (channel.type === ChannelType.Direct) {
				data.push({
					uuid: channel.uuid,
					type: channel.type,
					message_count,
					users: channel.usersID
				});
			} else {
				data.push({
					uuid: channel.uuid,
					default: channel.default,
					type: channel.type,
					identifier: channel.identifier,
					name: channel.name,
					password: channel.password !== null,
					avatar: channel.avatar,
					message_count,
					administrator: channel.administratorID,
					moderators: channel.moderatorsID,
					users: channel.usersID
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
		const channel: ChatsChannelsID = await this.channelRepository
			.createQueryBuilder('channels')
			.where({ uuid: channel_uuid })
			.loadRelationIdAndMap('channels.administratorID', 'channels.administrator')
			.loadRelationIdAndMap('channels.moderatorsID', 'channels.moderators')
			.loadRelationIdAndMap('channels.usersID', 'channels.users')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose('Unable to find channel ' + channel_uuid, e);
				throw new NotFoundException(ApiResponseError.ChannelNotFound);
			});

		//  prettier-ignore
		if (channel.type === ChannelType.Private && !this.user.inChannel(channel.usersID, user_uuid)) {
			throw new NotFoundException(ApiResponseError.ChannelNotFound);
		}

		const message_count = await this.messagesService.count(channel_uuid);

		if (channel.type === ChannelType.Direct) {
			return {
				uuid: channel.uuid,
				type: channel.type,
				message_count,
				users: channel.usersID
			};
		} else {
			return {
				uuid: channel.uuid,
				type: channel.type,
				identifier: channel.identifier,
				name: channel.name,
				password: channel.password !== null,
				avatar: channel.avatar,
				message_count,
				administrator: channel.administratorID,
				moderators: channel.moderatorsID,
				users: channel.usersID
			};
		}
	}

	async findPriv(params: ChannelPrivateProperty): Promise<ChannelPrivateGetResponse> {
		const channel: ChatsChannelsID = await this.channelRepository
			.createQueryBuilder('channels')
			.where({ name: params.name, identifier: params.identifier })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(
					`Unable to find channel ${params.name} #${params.identifier}`,
					e
				);
				throw new NotFoundException(ApiResponseError.ChannelNotFound);
			});

		return {
			uuid: channel.uuid,
			identifier: channel.identifier,
			name: channel.name,
			avatar: channel.avatar
		};
	}

	private readonly create = {
		channel: async (params: ChatsGroupPublic | ChatsGroupPrivate) => {
			const user = params.current_user;

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
				default: params.current_user.adam,
				identifier: params.current_user.adam ? 0 : await this.getIdentifier(params.name),
				name: params.name,
				password,
				administrator: user
			});
			request.addUser(user);

			const new_channel = await this.save(request, 'Unable to create channel');

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
			if (params.current_user.uuid === params.user_uuid) {
				throw new BadRequestException("You can't DM yourself");
			}

			const current_user = params.current_user;
			const remote_user = await this.usersRepository
				.findOneByOrFail({ uuid: params.user_uuid })
				.catch((e) => {
					this.logger.error('Unable to find relatiom user ' + params.user_uuid, e);
					throw new NotFoundException(ApiResponseError.RemoteUserNotFound);
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
				identifier: await this.getIdentifier(name),
				name
			});
			request.addUser(current_user);
			request.addUser(remote_user);
			const new_direct = await this.save(request, 'Unable to create channel');

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

		let channel: ChatsChannelsID;
		switch (parsed.type) {
			case ChannelType.Public:
				// is channel public create request
				if (isEmpty(parsed.channel_uuid)) {
					return await this.create.channel(parsed); // Return channel uuid
				}
				// is channel public join request
				else {
					channel = await this.findOne.WithUsersAndRelationsID(
						{ uuid: parsed.channel_uuid },
						`Unable to find public channel ${parsed.channel_uuid}`
					);
				}
				break;
			case ChannelType.Private:
				// is channel private create request
				if (parsed.identifier === undefined) {
					return await this.create.channel(parsed); // Return channel uuid
				}
				// is channel private join request
				else {
					channel = await this.findOne.WithUsersAndRelationsID(
						{ identifier: parsed.identifier, name: parsed.name },
						`Unable to find private channel ${parsed.name}#${parsed.identifier}`
					);
				}
				break;
			default:
				throw new BadRequestException();
		}

		// Obfuscate result
		if (channel.type === ChannelType.Direct) {
			throw new NotFoundException(ApiResponseError.ChannelNotFound);
		}

		const isBanned = await this.blacklistService.isBanned(
			channel.uuid,
			params.current_user.uuid
		);
		if (isBanned) {
			throw new ForbiddenException(ApiResponseError.Banned);
		}

		if (this.user.inChannel(channel.usersID, parsed.current_user.uuid)) {
			throw new BadRequestException(ApiResponseError.AlreadyInChannel);
		}

		// Channel has password
		if (channel.password) {
			if (isEmpty(parsed.password)) {
				throw new BadRequestException(ApiResponseError.WrongPassword);
			}
			const verif = await hash_verify(channel.password, parsed.password);
			if (!verif) {
				throw new BadRequestException(ApiResponseError.WrongPassword);
			}
		}

		// Update database relation
		const { channelObj, userObj } = await this.updateRelation(
			channel,
			parsed.current_user.uuid
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

	readonly blacklist = {
		add: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			//  prettier-ignore
			if (!params.current_user.adam												// Check administrator
			&& (!this.user.hasPermissions(channel, params.current_user.uuid)			// Check permissions
			|| this.user.isAdministrator(channel.administratorID, params.user_uuid)		// Check if remote user is administrator
			|| this.user.isModerator(channel.moderatorsID, params.user_uuid))) {		// Check if remote user is moderator) {
				throw new ForbiddenException(ApiResponseError.NotAllowed);
			}

			await this.blacklistService.create(params, channel);

			return channel;
		},
		remove: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			//  prettier-ignore
			if (!params.current_user.adam
			&& !this.user.hasPermissions(channel, params.current_user.uuid)) {
				throw new ForbiddenException(ApiResponseError.NotAllowed);
			}

			await this.blacklistService.delete(params, channel);

			return channel;
		},
		get: async (params: BlacklistGetProperty) => {
			const channel = await this.findOne.WithRelationsID(params.channel_uuid);

			//  prettier-ignore
			if (!params.current_user.adam
			&& !this.user.hasPermissions(channel, params.current_user.uuid)) {
				throw new ForbiddenException(ApiResponseError.NotAllowed);
			}

			return await this.blacklistService.get(channel.uuid);
		}
	};

	readonly moderation = {
		dispatch: async (params: ChannelModerationPropertyEX) => {
			let channel = await this.findOne.WithAllAndRelationsID(
				{ uuid: params.channel_uuid },
				'Unable to find channel ' + params.channel_uuid
			);

			let error_msg: string;
			switch (params.action) {
				case ChatAction.Promote:
					channel = await this.moderation.promote(params, channel);
					error_msg = 'Unable to update moderators for channel ' + channel.uuid;
					break;
				case ChatAction.Demote:
					channel = await this.moderation.demote(params, channel);
					error_msg = 'Unable to update moderators for channel ' + channel.uuid;
					break;
				case ChatAction.Ban:
					channel = await this.moderation.ban(params, channel);
					error_msg = 'Unable to update ban list for channel ' + channel.uuid;
					break;
				case ChatAction.Unban:
					channel = await this.moderation.unban(params, channel);
					error_msg = 'Unable to update ban list for channel ' + channel.uuid;
					break;
				case ChatAction.Mute:
					channel = await this.moderation.mute(params, channel);
					error_msg = 'Unable to update mute list for channel ' + channel.uuid;
					break;
				case ChatAction.Unmute:
					channel = await this.moderation.unmute(params, channel);
					error_msg = 'Unable to update mute list for channel ' + channel.uuid;
					break;
				default:
					throw new BadRequestException('Invalid action');
			}

			await this.save(channel, error_msg);

			const expiration = params.expiration !== 0 ? dateFromOffset(params.expiration) : null;
			this.wsService.dispatch.channel({
				namespace: WsNamespace.Chat,
				action: params.action,
				user: params.user_uuid,
				channel: channel.uuid,
				expiration
			});
		},
		promote: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			// Check administrator
			if (!params.current_user.adam) {
				// Check administrator permissions
				if (!this.user.isAdministrator(channel.administratorID, params.current_user.uuid)) {
					throw new ForbiddenException(ApiResponseError.NotAllowed);
				}

				// Check if remote user is the current channel administrator
				if (this.user.isAdministrator(channel.administratorID, params.user_uuid)) {
					throw new BadRequestException(ApiResponseError.isAdministrator);
				}

				// Check if remote user is already a channel moderator
				if (this.user.isModerator(channel.moderatorsID, params.user_uuid)) {
					throw new BadRequestException(ApiResponseError.AlreadyModerator);
				}

				// Check if remote user is in channel
				if (!this.user.inChannel(channel.usersID, params.user_uuid)) {
					throw new BadRequestException(ApiResponseError.NotAllowed);
				}
			}

			// Get remote user
			const user = await this.usersRepository
				.findOneByOrFail({ uuid: params.user_uuid })
				.catch((e) => {
					this.logger.verbose('Unable to find remote user ' + params.user_uuid, e);
					throw new NotFoundException(ApiResponseError.RemoteUserNotFound);
				});
			channel.addModerator(user);

			return channel;
		},
		demote: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			// Check administrator
			if (!params.current_user.adam) {
				// Check administrator permissions
				if (!this.user.isAdministrator(channel.administratorID, params.current_user.uuid)) {
					throw new ForbiddenException(ApiResponseError.NotAllowed);
				}

				// Check if remote user is a channel moderator
				if (!this.user.isModerator(channel.moderatorsID, params.user_uuid)) {
					throw new BadRequestException(ApiResponseError.ModeratorNotFound);
				}
			}

			channel.moderators = channel.moderators.filter((m) => m.uuid !== params.user_uuid);

			return channel;
		},
		ban: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			channel = await this.blacklist.add(params, channel);

			channel.users = channel.users.filter((u) => u.uuid !== params.user_uuid);

			return channel;
		},
		unban: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			return await this.blacklist.remove(params, channel);
		},
		mute: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			return await this.blacklist.add(params, channel);
		},
		unmute: async (params: ChannelModerationPropertyEX, channel: ChatsChannelsID) => {
			return await this.blacklist.remove(params, channel);
		},
		avatar: async (filename: string, channel: ChatsChannelsID) => {
			const old_avatar = channel.avatar;
			channel.avatar = filename;

			await this.save(channel, 'Unable to update avatar for channel ' + channel.uuid);

			switch (channel.type) {
				case ChannelType.Public:
					this.wsService.dispatch.all({
						namespace: WsNamespace.Chat,
						action: ChatAction.Avatar,
						channel: channel.uuid,
						avatar: filename
					});
					break;
				case ChannelType.Private:
					this.wsService.dispatch.channel({
						namespace: WsNamespace.Chat,
						action: ChatAction.Avatar,
						channel: channel.uuid,
						avatar: filename
					});
					break;
			}

			return { new: filename, old: old_avatar };
		}
	};

	async password(params: ChannelSettingProperty) {
		const channel = await this.findOne.WithRelationsID(params.channel_uuid);

		//  prettier-ignore
		if (channel.default
		|| (!params.current_user.adam
		&& !this.user.hasPermissions(channel, params.current_user.uuid))) {
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		let password: string;
		if (isEmpty(params.password)) {
			password = null;
		} else {
			channel.password = await argon2.hash(params.password, {
				timeCost: 11,
				saltLength: 128
			});
		}

		await this.save(channel, 'Unable to update channel password for ' + channel.uuid);
	}

	async leave(params: ChannelLeaveProperty) {
		const channel = await this.findOne.WithAllAndRelationsID(
			{ uuid: params.channel_uuid },
			'Unable to find channel ' + params.channel_uuid
		);

		if (channel.type === ChannelType.Direct) {
			throw new BadRequestException("You can't leave direct channel");
		}

		//  prettier-ignore
		if (!params.current_user.adam
		&& !this.user.inChannel(channel.usersID, params.current_user.uuid)) {
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		let remove_user: UsersInfos = undefined;
		switch (params.action) {
			case LeaveAction.Leave:
				if (params.current_user.adam && channel.default) {
					throw new ForbiddenException(ApiResponseError.NotAllowed);
				}
				if (this.user.isAdministrator(channel.administratorID, params.current_user.uuid)) {
					channel.administrator = null;
				}
				remove_user = params.current_user;
				break;
			case LeaveAction.Kick:
				if (!params.current_user.adam) {
					//  prettier-ignore
					if (!this.user.hasPermissions(channel, params.current_user.uuid) 		// Check current user permissions
					|| this.user.isAdministrator(channel.administratorID, params.user_uuid) // Check if remote user is administrator
					|| this.user.isModerator(channel.moderatorsID, params.user_uuid)) { 	// Check if remote user is moderator
						throw new ForbiddenException(ApiResponseError.NotAllowed);
					}
					if (!this.user.inChannel(channel.usersID, params.user_uuid)) {
						throw new BadRequestException(ApiResponseError.RemoteUserNotFound);
					}
				}
				remove_user = await this.usersRepository
					.findOneByOrFail({ uuid: params.user_uuid })
					.catch((e) => {
						this.logger.verbose('Unable to find user ' + remove_user, e);
						throw new NotFoundException(ApiResponseError.RemoteUserNotFound);
					});
				break;
			case LeaveAction.Remove:
				//  prettier-ignore
				if  (channel.default
				|| (!params.current_user.adam
				&& !this.user.isAdministrator(channel.administratorID, params.current_user.uuid))) {
					throw new ForbiddenException(ApiResponseError.NotAllowed);
				}
				break;
			default:
				throw new BadRequestException('Invalid action');
		}

		if (remove_user !== undefined) {
			channel.moderators = channel.moderators.filter((m) => m.uuid !== remove_user.uuid);
			channel.users = channel.users.filter((user) => user.uuid !== remove_user.uuid);

			await this.save(
				channel,
				'Unable to remove user ' + remove_user.uuid + ' from channel ' + channel.uuid
			);
		}

		const removed_user_uuid = params.user_uuid ? params.user_uuid : params.current_user.uuid;

		if ((!channel.users.length && !channel.default) || params.action === LeaveAction.Remove) {
			await this.channelRepository.delete(channel.uuid).catch((e) => {
				this.logger.error('Unable to delete channel ' + channel.uuid, e);
				throw new InternalServerErrorException();
			});

			switch (channel.type) {
				case ChannelType.Public:
					this.wsService.dispatch.all({
						namespace: WsNamespace.Chat,
						action: ChatAction.Remove,
						channel: params.channel_uuid
					});
					break;
				case ChannelType.Private:
					this.wsService.dispatch.channel({
						namespace: WsNamespace.Chat,
						action: ChatAction.Remove,
						channel: params.channel_uuid
					});
					break;
			}
		} else {
			this.wsService.dispatch.channel({
				namespace: WsNamespace.Chat,
				action: ChatAction.Leave,
				channel: params.channel_uuid,
				user: removed_user_uuid
			});
		}
		this.wsService.unsubscribe.channel(removed_user_uuid, params.channel_uuid);
	}
	//#endregion
}
