import {
	Injectable,
	Logger,
	InternalServerErrorException,
	NotFoundException,
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
		private readonly wsService: WsService,
	) {}

	/**
	 * Utils
	 */
	//#region
	//#endregion

	/**
	 * Service
	 */
	//#region

	async add(
		type: NotifcationType,
		interact_w_user: UsersInfos,
		notified_user: UsersInfos,
		lobby_uuid?: string,
	) {
		const request = this.notifcationsRepository.create({
			type: type,
			notified_user: notified_user.uuid,
			interact_w_user: interact_w_user.uuid,
			creation_date: new Date(),
			lobby: lobby_uuid ?? null,
			read: false,
		});

		const notif = await this.notifcationsRepository.save(request).catch((e) => {
			if (request.type === NotifcationType.GameInvite) {
				this.logger.error(
					`Unable to create notification type \
				${request.type} for current user \
				${request.notified_user} sending to remote user \
				${request.interact_w_user} for lobby \
				${lobby_uuid}`,
					e,
				);
			} else {
				this.logger.error(
					`Unable to create notification type \
				${request.type} for current user \
				${request.notified_user} sending to remote user \
				${request.interact_w_user}`,
					e,
				);
			}
			throw new InternalServerErrorException();
		});

		if (request.type === NotifcationType.GameInvite) {
			this.wsService.dispatch.user(request.notified_user, {
				namespace: WsNamespace.User,
				action: UserAction.Notification,
				type: request.type,
				uuid: notif.uuid,
				user: request.interact_w_user,
				lobby: lobby_uuid,
			});
		} else {
			this.wsService.dispatch.user(request.notified_user, {
				namespace: WsNamespace.User,
				action: UserAction.Notification,
				type: request.type,
				uuid: notif.uuid,
				user: request.interact_w_user,
				creation_date: request.creation_date,
			});
		}
	}

	async get(
		user: UsersInfos,
		page: number = 1,
		limit: number = 0,
		offset: number = 0,
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

		const data = (request[0] as any[]).map((r) => {
			const { lobby, ...filter } = r;
			return {
				...filter,
				lobby: lobby ? lobby : undefined,
			};
		});
		const count = request[0].length;
		const total = request[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;

		return { data, count, total, page, page_count };
	}

	public readonly read = {
		ByUUID: async (user: UsersInfos, uuid: string) => {
			const notif = await this.notifcationsRepository
				.createQueryBuilder('notif')
				.where({ uuid })
				.andWhere({ notified_user: user.uuid })
				.getOneOrFail()
				.catch((e) => {
					this.logger.verbose('No notification found for uuid ' + uuid, e);
					throw new NotFoundException();
				});

			if (notif.read) {
				return;
			}

			notif.read = true;

			await this.notifcationsRepository.save(notif).catch((e) => {
				this.logger.error('Unable to read notification for uuid ' + notif.uuid);
				throw new InternalServerErrorException();
			});

			this.wsService.dispatch.user(user.uuid, {
				namespace: WsNamespace.User,
				action: UserAction.Read,
				uuid: notif.uuid,
			});
		},
		ByType: async (
			current_user: UsersInfos,
			remote_user: UsersInfos,
			notifcation_type: Array<NotifcationType>,
		) => {
			const notifs = await this.notifcationsRepository
				.createQueryBuilder('notifs')
				.where({
					notified_user: current_user,
					interact_w_user: remote_user,
					read: false,
				})
				.getMany()
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.error('Unable to get notifications for ');
					return null;
				});

			if (!notifs) {
				return;
			}

			let promises = [];
			for (const notif of notifs) {
				if (!notifcation_type.includes(notif.type)) {
					continue;
				}

				notif.read = true;

				promises.push(
					this.notifcationsRepository
						.save(notifs)
						.then(() => {
							this.logger.debug('Read notification ' + notif.uuid);
							this.wsService.dispatch.user(current_user.uuid, {
								namespace: WsNamespace.User,
								action: UserAction.Read,
								uuid: notif.uuid,
							});
						})
						.catch((e) => {
							this.logger.error(
								'Unable to read notifications for ' + current_user.uuid,
								e,
							);
						}),
				);
			}

			await Promise.all(promises);
		},
		ByRelation: async (interact_w_user_uuid: string, notified_user_uuid: string) => {
			const notifs: Array<UsersNotifications> | null = await this.notifcationsRepository
				.createQueryBuilder('notifs')
				.where({
					interact_w_user: interact_w_user_uuid,
					notified_user: notified_user_uuid,
					read: false,
				})
				.loadAllRelationIds()
				.getMany()
				.then((r) => (r.length ? r : null))
				.catch((e) => {
					this.logger.error(
						'Unable to get notifications for user ' + notified_user_uuid,
						e,
					);
					return null;
				});

			if (!notifs) {
				return;
			}

			let promises = [];
			for (const notif of notifs) {
				notif.read = true;

				promises.push(
					this.notifcationsRepository
						.save(notif)
						.then(() => {
							this.logger.debug('Read notification ' + notif.uuid);
							this.wsService.dispatch.user(notif.notified_user, {
								namespace: WsNamespace.User,
								action: UserAction.Read,
								uuid: notif.uuid,
							});
						})
						.catch((e) => {
							this.logger.error(
								'Unable to read notifications for ' + notif.notified_user,
								e,
							);
						}),
				);
			}
			await Promise.all(promises);
		},
		//
		//  Legacy code
		//
		// 	ByLobby: async (lobby_uuid: string, notified_user_uuid?: string) => {
		// 		console.log(
		// 			await this.notifcationsRepository
		// 				.createQueryBuilder('notifs')
		// 				.where({ lobby: lobby_uuid, read: false, notified_user: notified_user_uuid })
		// 				.loadAllRelationIds()
		// 				.getMany()
		// 		);
		// 		const notifs: Array<UsersNotifications> | null = await this.notifcationsRepository
		// 			.createQueryBuilder('notifs')
		// 			.where({
		// 				lobby: lobby_uuid,
		// 				read: false,
		// 				notified_user: notified_user_uuid
		// 			})
		// 			.loadAllRelationIds()
		// 			.getMany()
		// 			.then((r) => (r.length ? r : null))
		// 			.catch((e) => {
		// 				this.logger.error('Unable to get notifications for lobby ' + lobby_uuid, e);
		// 				return null;
		// 			});

		// 		if (!notifs) {
		// 			return;
		// 		}
		// 		console.log(lobby_uuid, notified_user_uuid);

		// 		let promises = [];
		// 		for (const notif of notifs) {
		// 			notif.read = true;

		// 			promises.push(
		// 				this.notifcationsRepository
		// 					.save(notif)
		// 					.then(() => {
		// 						this.logger.debug('Read notification ' + notif.uuid);
		// 						this.wsService.dispatch.user(notif.notified_user, {
		// 							namespace: WsNamespace.User,
		// 							action: UserAction.Read,
		// 							uuid: notif.uuid
		// 						});
		// 					})
		// 					.catch((e) => {
		// 						this.logger.error(
		// 							'Unable to read notifications for ' + notif.notified_user,
		// 							e
		// 						);
		// 					})
		// 			);
		// 		}
		// 		await Promise.all(promises);
		// 	}
	};

	//#endregion
}
