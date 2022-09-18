import {
	Injectable,
	Logger,
	InternalServerErrorException,
	NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WsService } from '../../websockets/ws.service';

import { ChatsMessages } from '../entities/messages.entity';
import { ChatsChannels } from '../entities/channels.entity';
import { UsersInfos } from '../../users/users.entity';

import { MessageStoreProperty } from '../properties/messages.store.property';
import { MessagesGetResponse } from '../properties/messages.get.propoerty';

import { ChatState, DispatchChannelSend, DispatchChannelDelete } from '../../websockets/types';

@Injectable()
export class MessagesService {
	private readonly logger = new Logger(MessagesService.name);
	constructor(
		@InjectRepository(ChatsMessages) readonly messageRepository: Repository<ChatsMessages>,
		@InjectRepository(ChatsChannels) readonly channelRepository: Repository<ChatsChannels>,
		@InjectRepository(UsersInfos) readonly usersRepository: Repository<UsersInfos>,
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
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<MessagesGetResponse> {
		if (page === 0) {
			page = 1;
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
		const pageCount = limit ? Math.ceil(total / limit) : 0;
		return { data, count, total, page, pageCount };
	}

	async store(params: MessageStoreProperty) {
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
		// TODO: Dispatch new message
		const data: DispatchChannelSend = {
			state: ChatState.Send,
			channel: new_message.channel,
			user: new_message.user,
			id: new_message.id,
			message: new_message.message,
			creation_date: new_message.creation_date
		};
		this.wsService.dispatch.channel(data);
	}

	async delete(id: number) {
		const message = await this.messageRepository.findOneByOrFail({ id }).catch((e) => {
			this.logger.verbose('Unable to find message ' + id, e);
			throw new NotFoundException();
		});

		await this.messageRepository.save({ ...message, message: null });
		// TODO: Dispatch delete message
		const data: DispatchChannelDelete = {
			state: ChatState.Delete,
			user: message.user,
			channel: message.channel,
			id: message.id
		};
		this.wsService.dispatch.channel(data);
	}
}
