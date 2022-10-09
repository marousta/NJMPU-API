import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { WsService } from '../websockets/ws.service';

import { UsersInfos, UsersInfosID } from './users.entity';

import {
	UsersFriendshipGetResponse,
	UsersRelationsProperty
} from './properties/users.relations.get.property';
import { UsersMeResponse } from './properties/users.get.property';

import { UserAction, WsNamespace } from '../websockets/types';
import { ApiResponseError, UsersFriendship } from './types';

import { genIdentifier } from '../utils';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
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

	private async findWithRelationsID(where: object, error_msg: string): Promise<UsersInfosID> {
		return this.usersRepository
			.createQueryBuilder('user')
			.where(where)
			.loadRelationIdAndMap('user.friendsID', 'user.friends')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				throw new NotFoundException();
			});
	}

	private async findWithRelationsIDorNull(
		where: object,
		error_msg: string
	): Promise<UsersInfosID | null> {
		return this.usersRepository
			.createQueryBuilder('user')
			.where(where)
			.loadRelationIdAndMap('user.friendsID', 'user.friends')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				return null;
			});
	}

	usersAreFriends(current_user: UsersInfosID, remote_user: UsersInfosID): UsersFriendship {
		const current_friend = current_user.friendsID.includes(remote_user.uuid);
		const remote_friend = remote_user.friendsID.includes(current_user.uuid);

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

	async me(uuid: string): Promise<UsersMeResponse> {
		const user = await this.usersRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.error('Unable to find user ' + uuid, e);
			throw new InternalServerErrorException();
		});

		return {
			uuid: user.uuid,
			identifier: user.identifier,
			username: user.username,
			email: user.email,
			twofactor: user.twofactor !== null,
			avatar: user.avatar
		};
	}

	async get(current_user_uuid: string, remote_user_uuid: string) {
		const user = await Promise.all([
			this.findWithRelationsID(
				{ uuid: remote_user_uuid },
				"Remote user doesn't exist " + remote_user_uuid
			),
			this.findWithRelationsID(
				{ uuid: current_user_uuid },
				"Current user doesn't exist " + remote_user_uuid // Should never fail
			)
		]);

		const remote_user = user[0];
		const current_user = user[1];

		return {
			uuid: remote_user.uuid,
			identifier: remote_user.identifier,
			username: remote_user.username,
			avatar: remote_user.avatar,
			is_online: remote_user.is_online,
			friendship: this.usersAreFriends(current_user, remote_user)
		};
	}

	async avatar(uuid: string, avatar: string) {
		const user = await this.usersRepository
			.findOneByOrFail({
				uuid
			})
			.catch((e) => {
				this.logger.error('Unable to find user ' + uuid, e);
				throw new InternalServerErrorException();
			});

		const old_avatar = avatar;
		user.avatar = avatar;

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update avatar for user ' + uuid, e);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.all({
			namespace: WsNamespace.User,
			action: UserAction.Avatar,
			user: user.uuid
		});

		return { new: avatar, old: old_avatar };
	}

	public readonly relations = {
		dispatch: async (params: UsersRelationsProperty) => {
			if (params.current_user_uuid === params.user_uuid) {
				throw new BadRequestException(ApiResponseError.FriendYourself);
			}

			const user: UsersInfosID = await this.findWithRelationsID(
				{ uuid: params.current_user_uuid },
				'Unable to find current user ' + params.current_user_uuid // Should never fail
			);

			switch (params.action) {
				default:
					return await this.relations.friends.add(user, params.user_uuid);
			}
		},
		get: async (uuid: string): Promise<UsersFriendshipGetResponse[]> => {
			const current_user = await this.findWithRelationsID(
				{ uuid },
				'Unable to find user ' + uuid // Should never fail
			);

			let users_promise: Promise<UsersInfosID>[] = [];
			current_user.friendsID.forEach((uuid) => {
				users_promise.push(
					this.findWithRelationsIDorNull(
						{ uuid },
						'Unable to find user ' + uuid + ' for relation matching'
					)
				);
			});

			const users = await Promise.all(users_promise);

			let friendship: UsersFriendshipGetResponse[] = [];
			users.forEach((remote_user) => {
				if (!remote_user) {
					return;
				}

				const friendship_status = this.usersAreFriends(current_user, remote_user);
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
			add: async (current_user: UsersInfosID, remote_user_uuid: string) => {
				const remote_user = await this.findWithRelationsID(
					{ uuid: remote_user_uuid },
					'Unable to find remote user ' + remote_user_uuid
				);

				const friendship_status = this.usersAreFriends(current_user, remote_user);
				switch (friendship_status) {
					case UsersFriendship.True:
						throw new BadRequestException(ApiResponseError.AlreadyFriends);
					case UsersFriendship.Pending:
						throw new BadRequestException(ApiResponseError.AlreadyPending);
				}

				current_user.addFriends(remote_user);
				await this.usersRepository.save(current_user);

				return { friendship: this.usersAreFriends(current_user, remote_user) };
			},
			remove: async () => {}
		}
	};
}
