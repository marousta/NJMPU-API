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

import { NotificationsDeleteProperty } from '../properties/notifications.delete';
import { NotificationsGetResponse } from '../properties/notifications.get.property';

import { UserAction, WsNamespace } from '../../websockets/types';
import { NotificationsCreateProperty } from '../types';

@Injectable()
export class NotifcationsService {
	private readonly logger = new Logger(NotifcationsService.name);
	constructor(
		@InjectRepository(UsersNotifications)
		private readonly notifcationsRepository: Repository<UsersNotifications>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */

	/**
	 * Service
	 */
	async add(notification: NotificationsCreateProperty) {
		const request = this.notifcationsRepository.create({
			type: notification.type,
			notified_user: notification.notified_user,
			interact_w_user: notification.interact_w_user,
			creation_date: new Date()
		});
		await this.notifcationsRepository.save(request).catch((e) => {
			this.logger.error(
				`Unable to create notification type \
				${request.type} for current user \
				${request.notified_user} sending to remote user \
				${request.interact_w_user}`,
				e
			);
		});
		this.wsService.dispatch.user(request.notified_user, {
			namespace: WsNamespace.User,
			action: UserAction.Notification,
			type: request.type,
			user: request.interact_w_user,
			creation_date: request.creation_date
		});
	}

	async get(
		uuid: string,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<NotificationsGetResponse> {
		if (page === 0) {
			page = 1;
		}

		const request = await this.notifcationsRepository
			.createQueryBuilder('notif')
			.where({ notified_user: { uuid } })
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

	async delete(params: NotificationsDeleteProperty) {
		const request = await this.notifcationsRepository
			.findOneByOrFail({ uuid: params.notification_uuid })
			.catch((e) => {
				this.logger.verbose(
					'No notification found for uuid ' + params.notification_uuid,
					e
				);
				throw new NotFoundException();
			});

		request.read = true;

		await this.notifcationsRepository.save(request).catch((e) => {
			this.logger.error('Unable to read notification for uuid ' + request.uuid);
			throw new InternalServerErrorException();
		});
	}
}
