import {
	Injectable,
	Logger,
	InternalServerErrorException,
	NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WsService } from '../../websockets/ws.service';

import { UsersNotifications } from '../entities/notifications.entity';
import { UsersInfos } from '../entities/users.entity';

import { NotificationsGetResponse } from '../properties/notifications.get.property';

import { UserAction, WsNamespace } from '../../websockets/types';
import { NotifcationType } from '../types';

@Injectable()
export class NotifcationsService {
	private readonly logger = new Logger(NotifcationsService.name);
	constructor(
		@InjectRepository(UsersNotifications)
		private readonly notifcationsRepository: Repository<UsersNotifications>,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */

	/**
	 * Service
	 */
	async add(type: NotifcationType, interact_w_user: UsersInfos, notified_user: UsersInfos) {
		const request = this.notifcationsRepository.create({
			type: type,
			notified_user: notified_user.uuid,
			interact_w_user: interact_w_user.uuid,
			creation_date: new Date(),
			read: false
		});

		const notif = await this.notifcationsRepository.save(request).catch((e) => {
			this.logger.error(
				`Unable to create notification type \
				${request.type} for current user \
				${request.notified_user} sending to remote user \
				${request.interact_w_user}`,
				e
			);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.user(request.notified_user, {
			namespace: WsNamespace.User,
			action: UserAction.Notification,
			type: request.type,
			uuid: notif.uuid,
			user: request.interact_w_user,
			creation_date: request.creation_date
		});
	}

	async get(
		user: UsersInfos,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<NotificationsGetResponse> {
		if (page === 0) {
			page = 1;
		}

		const request = await this.notifcationsRepository
			.createQueryBuilder('notif')
			.where({ notified_user: user.uuid })
			.orderBy('read', 'ASC')
			.addOrderBy('type', 'DESC')
			.addOrderBy('creation_date', 'DESC')
			.loadRelationIdAndMap('notif.user', 'notif.interact_w_user')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.getManyAndCount();

		const data = request[0] as any;
		const count = request[0].length;
		const total = request[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;

		return { data, count, total, page, page_count };
	}

	async delete(user: UsersInfos, uuid: string) {
		const request = await this.notifcationsRepository
			.createQueryBuilder('notif')
			.where({ uuid })
			.andWhere({ notified_user: user.uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose('No notification found for uuid ' + uuid, e);
				throw new NotFoundException();
			});

		request.read = true;

		await this.notifcationsRepository.save(request).catch((e) => {
			this.logger.error('Unable to read notification for uuid ' + request.uuid);
			throw new InternalServerErrorException();
		});
	}
}
