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

import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsMessages } from '../entities/messages.entity';

import { MessageStoreProperty } from '../properties/messages.store.property';
import { MessagesGetResponse } from '../properties/messages.get.propoerty';

import { ApiResponseError } from '../types';
import { WsNamespace, ChatAction } from '../../websockets/types';
import { ChannelsBlacklistService } from './channels.blacklist.service';

@Injectable()
export class MessagesService {
	private readonly logger = new Logger(MessagesService.name);
	constructor(
		@InjectRepository(ChatsMessages)
		private readonly messageRepository: Repository<ChatsMessages>,
		@Inject(forwardRef(() => ChannelsService))
		private readonly channelsService: ChannelsService,
		private readonly blacklistService: ChannelsBlacklistService,
		private readonly wsService: WsService
	) {}

	async count(channel_uuid: string) {
		return this.messageRepository
			.createQueryBuilder('message')
			.where({ channel: channel_uuid })
			.orderBy('creation_date', 'ASC')
			.loadRelationIdAndMap('message.user', 'message.user')
			.getCount();
	}

	async get(
		channel_uuid: string,
		current_user: UsersInfos,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<MessagesGetResponse> {
		if (page === 0) {
			page = 1;
		}

		if (!current_user.adam) {
			const userInChannel = await this.channelsService.user.inChannelFind(
				channel_uuid,
				current_user.uuid
			);
			if (!userInChannel) {
				throw new ForbiddenException(ApiResponseError.NotAllowed);
			}
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
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async store(params: MessageStoreProperty) {
		const requests = await Promise.all([
			this.channelsService.user.inChannelFind(params.channel_uuid, params.current_user.uuid),
			this.blacklistService.isMuted(params.channel_uuid, params.current_user.uuid)
		]);

		const userInChannel = requests[0];
		const muted = requests[1];

		if (!params.current_user.adam && (!userInChannel || muted)) {
			throw new ForbiddenException(ApiResponseError.NotAllowed);
		}

		const request = this.messageRepository.create({
			user: params.current_user.uuid,
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
		const requests = await Promise.all([
			this.messageRepository
				.findOneOrFail({ where: { id }, relations: ['user', 'channel'] })
				.catch((e) => {
					this.logger.verbose('Unable to find message ' + id, e);
					throw new NotFoundException(ApiResponseError.MessageNotFound);
				}),
			this.channelsService.findOne.WithRelationsID(channel_uuid)
		]);

		const message = requests[0];
		const channel = requests[1];
		const user = message.user as any as UsersInfos;

		//  prettier-ignore
		if (!user.adam
		&& !this.channelsService.user.hasPermissions(channel, user_uuid)	//User is not administrator or moderator
		&& user.uuid !== user_uuid) {										//User is not the message owner
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
