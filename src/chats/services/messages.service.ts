import {
	Injectable,
	Logger,
	InternalServerErrorException,
	NotFoundException,
	ForbiddenException,
	Inject,
	forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChannelsService } from './channels.service';
import { WsService } from '../../websockets/ws.service';

import { UsersInfos } from '../../users/users.entity';
import { ChatsChannels } from '../entities/channels.entity';
import { ChatsMessages } from '../entities/messages.entity';

import { MessageStoreProperty } from '../properties/messages.store.property';
import { MessagesGetResponse } from '../properties/messages.get.propoerty';

import { WsNamespace, ChatAction } from '../../websockets/types';
import { ApiResponseError } from '../types';

@Injectable()
export class MessagesService {
	private readonly logger = new Logger(MessagesService.name);
	constructor(
		@InjectRepository(ChatsMessages)
		private readonly messageRepository: Repository<ChatsMessages>,
		@InjectRepository(ChatsChannels)
		private readonly channelRepository: Repository<ChatsChannels>,
		@Inject(forwardRef(() => ChannelsService))
		private readonly channelsService: ChannelsService,
		private readonly wsService: WsService
	) {}

	async count(channel_uuid: string) {
		return await this.messageRepository
			.createQueryBuilder('message')
			.where({ channel: channel_uuid })
			.orderBy('creation_date', 'ASC')
			.loadRelationIdAndMap('message.user', 'message.user')
			.getCount();
	}

	async get(
		channel_uuid: string,
		user_uuid: string,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<MessagesGetResponse> {
		if (page === 0) {
			page = 1;
		}

		const channel = await this.channelRepository
			.findOneOrFail({
				where: { uuid: channel_uuid },
				relations: ['users']
			})
			.catch((e) => {
				this.logger.verbose('Channel not found', e);
				throw new NotFoundException(ApiResponseError.ChannelNotFound);
			});

		if (!this.channelsService.userInChannel(channel, user_uuid)) {
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		const ret = await this.messageRepository
			.createQueryBuilder('message')
			.where({ channel: channel_uuid })
			.orderBy('creation_date', 'ASC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.loadRelationIdAndMap('message.user', 'message.user')
			.getManyAndCount();

		const data = ret[0];
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 0;
		return { data, count, total, page, page_count };
	}

	async store(params: MessageStoreProperty) {
		const userInChannel = await this.channelsService.userInChannelFind(
			params.channel_uuid,
			params.user_uuid
		);
		if (!userInChannel) {
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		const request = this.messageRepository.create({
			user: params.user_uuid,
			channel: params.channel_uuid,
			creation_date: new Date(),
			message: params.message
		});

		const new_message = await this.messageRepository.save(request).catch((e) => {
			this.logger.error('Unable to save message', e);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.channel({
			namespace: WsNamespace.Chat,
			action: ChatAction.Send,
			channel: new_message.channel,
			user: new_message.user,
			message: {
				id: new_message.id,
				text: new_message.message,
				time: new_message.creation_date
			}
		});
	}

	async delete(channel_uuid: string, user_uuid: string, id: number) {
		const message = await this.messageRepository
			.findOneOrFail({ where: { id }, relations: ['user', 'channel'] })
			.catch((e) => {
				this.logger.verbose('Unable to find message ' + id, e);
				throw new NotFoundException(ApiResponseError.MessageNotFound);
			});

		const channel = await this.channelRepository
			.findOneOrFail({
				where: { uuid: channel_uuid },
				relations: ['administrator', 'moderators', 'users']
			})
			.catch((e) => {
				this.logger.error('Unable to find channel ' + channel_uuid, e);
				throw new InternalServerErrorException();
			});

		console.log((message.user as any as UsersInfos).uuid);

		//  prettier-ignore
		if (!this.channelsService.userHasPermissions(channel, user_uuid) //User is not administrator or moderator
		&& (message.user as any as UsersInfos).uuid !== user_uuid) //User is not the message owner
		{
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		await this.messageRepository.save({ ...message, message: null });

		this.wsService.dispatch.channel({
			namespace: WsNamespace.Chat,
			action: ChatAction.Delete,
			user: user_uuid,
			channel: channel_uuid,
			id: message.id
		});
	}
}
