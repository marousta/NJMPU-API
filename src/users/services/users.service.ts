import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { NotifcationsService } from './notifications.service';
import { WsService } from '../../websockets/ws.service';

import { UsersInfos, UsersInfosID } from '../entities/users.entity';

import { UsersFriendshipResponse } from '../properties/users.relations.get.property';
import { UsersMeResponse } from '../properties/users.get.property';

import { hash_password_config } from '../../auth/config';

import { genIdentifier } from '../../utils';
import { hash, hash_verify } from '../../auth/utils';

import { UserAction, WsNamespace } from '../../websockets/types';
import { ApiResponseError, UsersFriendship, NotifcationType } from '../types';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly notifcationsService: NotifcationsService,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	async getIdentfier(username: string) {
		while (true) {
			const users = await this.usersRepository.find({
				select: { identifier: true },
				where: { username }
			});
			const exclude: number[] = [];
			users?.forEach((u) => exclude.push(u.identifier));

			const id = genIdentifier(exclude);
			if (id === null) {
				username += Math.floor(Math.random() * 10);
				continue;
			}
			return id;
		}
	}

	async findWithRelationsOrNull(where: object, error_msg: string): Promise<UsersInfosID | null> {
		return this.usersRepository
			.createQueryBuilder('user')
			.where(where)
			.leftJoinAndSelect('user.friends', 'friends')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				return null;
			});
	}

	async findWithRelations(where: object, error_msg: string): Promise<UsersInfosID> {
		return this.usersRepository
			.createQueryBuilder('user')
			.where(where)
			.leftJoinAndSelect('user.friends', 'friends')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				throw new NotFoundException();
			});
	}

	usersAreFriends(current_user: UsersInfos, remote_user: UsersInfos): UsersFriendship {
		const current_friend = current_user.friends
			.map((user) => user.uuid)
			.includes(remote_user.uuid);
		const remote_friend = remote_user.friends
			.map((user) => user.uuid)
			.includes(current_user.uuid);

		if (current_friend && remote_friend) {
			return UsersFriendship.True;
		}

		if (current_friend && !remote_friend) {
			return UsersFriendship.Pending;
		}

		if (!current_friend && remote_friend) {
			return UsersFriendship.Requested;
		}

		return UsersFriendship.False;
	}

	/**
	 * Service
	 */
	async whoami(user: UsersInfos): Promise<UsersMeResponse> {
		return {
			uuid: user.uuid,
			identifier: user.identifier,
			username: user.username,
			email: user.email,
			twofactor: user.twofactor !== null,
			avatar: user.avatar
		};
	}

	async get(current_user: UsersInfos, remote_user_uuid: string) {
		const remote_user = await this.findWithRelations(
			{ uuid: remote_user_uuid },
			"Remote user doesn't exist " + remote_user_uuid
		);

		return {
			uuid: remote_user.uuid,
			identifier: remote_user.identifier,
			username: remote_user.username,
			avatar: remote_user.avatar,
			is_online: remote_user.is_online,
			friendship: this.usersAreFriends(current_user, remote_user)
		};
	}

	async avatar(user: UsersInfos, filename: string) {
		const old_avatar = user.avatar;
		user.avatar = filename;

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update avatar for user ' + user.uuid, e);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.all({
			namespace: WsNamespace.User,
			action: UserAction.Avatar,
			user: user.uuid,
			avatar: filename
		});

		return { new: filename, old: old_avatar };
	}

	async password(
		user: UsersInfos,
		current_password: string,
		new_password: string,
		new_password_confirm: string
	) {
		if (new_password !== new_password_confirm) {
			throw new BadRequestException(ApiResponseError.Confirmmismatch);
		}

		if (current_password === new_password) {
			throw new BadRequestException(ApiResponseError.PasswordsIdentical);
		}

		const verif = await hash_verify(user.password, current_password);
		if (!verif) {
			throw new BadRequestException(ApiResponseError.Passwordmismatch);
		}

		user.password = await hash(new_password, hash_password_config);

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update password for user ' + user.uuid, e);
			throw new BadRequestException();
		});
	}

	public readonly relations = {
		dispatch: async (action: string, current_user: UsersInfos, remote_user_uuid: string) => {
			if (current_user.uuid === remote_user_uuid) {
				throw new BadRequestException(ApiResponseError.FriendYourself);
			}

			const remote_user = await this.findWithRelations(
				{ uuid: remote_user_uuid },
				'Unable to find remote user ' + remote_user_uuid
			);

			switch (action) {
				case 'ADD':
					return await this.relations.friends.add(current_user, remote_user);
				case 'REMOVE':
					return await this.relations.friends.remove(current_user, remote_user);
			}
		},
		get: async (user: UsersInfos): Promise<UsersFriendshipResponse[]> => {
			const users = user.friends;

			let friendship: UsersFriendshipResponse[] = [];
			users.forEach((remote_user) => {
				if (!remote_user) {
					return;
				}

				const friendship_status = this.usersAreFriends(user, remote_user);
				if (!friendship_status) {
					return;
				}

				friendship.push({
					uuid: remote_user.uuid,
					friendship: friendship_status
				});
			});

			return friendship;
		},
		friends: {
			add: async (current_user: UsersInfos, remote_user: UsersInfos) => {
				let friendship_status = this.usersAreFriends(current_user, remote_user);
				switch (friendship_status) {
					case UsersFriendship.True:
						throw new BadRequestException(ApiResponseError.AlreadyFriends);
					case UsersFriendship.Pending:
						throw new BadRequestException(ApiResponseError.AlreadyPending);
				}

				current_user.addFriends(remote_user);
				await this.usersRepository.save(current_user).catch((e) => {
					this.logger.error(
						'Unable to update friendship status of user ' + current_user.uuid,
						e
					);
					throw new InternalServerErrorException();
				});

				friendship_status = this.usersAreFriends(current_user, remote_user);
				switch (friendship_status) {
					case UsersFriendship.Pending:
						this.notifcationsService.add(
							NotifcationType.FriendRequest,
							current_user,
							remote_user
						);
						break;
					case UsersFriendship.True:
						this.notifcationsService.add(
							NotifcationType.AcceptedFriendRequest,
							current_user,
							remote_user
						);
						break;
				}

				return { friendship: friendship_status };
			},
			remove: async (current_user: UsersInfos, remote_user: UsersInfos) => {
				const friendship_status = this.usersAreFriends(current_user, remote_user);
				if (friendship_status === UsersFriendship.False) {
					return;
				}

				remote_user.friends = remote_user.friends.filter(
					(user) => user.uuid !== current_user.uuid
				);
				current_user.friends = current_user.friends.filter(
					(user) => user.uuid !== remote_user.uuid
				);

				await this.usersRepository.save([current_user, remote_user]).catch((e) => {
					this.logger.error(
						'Unable to remove friendship status of users ' +
							current_user.uuid +
							' and ' +
							remote_user.uuid,
						e
					);
					throw new InternalServerErrorException();
				});
			}
		}
	};

	async invite(interact_w_user: UsersInfos, notified_user_uuid: string) {
		if (interact_w_user.uuid === notified_user_uuid) {
			throw new BadRequestException(ApiResponseError.InteractYourself);
		}

		const notified_user = await this.usersRepository
			.findOneByOrFail({ uuid: notified_user_uuid })
			.catch((e) => {
				this.logger.verbose(
					'Unable to find user to interact with ' + notified_user_uuid,
					e
				);
				throw new NotFoundException();
			});

		this.notifcationsService.add(NotifcationType.GameInvite, interact_w_user, notified_user);
	}
}
