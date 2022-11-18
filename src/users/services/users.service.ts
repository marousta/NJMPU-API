import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';

import { NotifcationsService } from './notifications.service';
import { WsService } from '../../websockets/ws.service';
import { PicturesService } from '../../pictures/pictures.service';

import { UsersInfos } from '../entities/users.entity';

import {
	UsersFriendshipResponse,
	UsersRelationsResponse
} from '../properties/users.relations.get.property';
import { UsersMeResponse, UsersGetResponse } from '../properties/users.get.property';
import { SignupProperty } from 'src/auth/properties/signup.property';

import { hash_password_config } from '../../auth/config';

import { genIdentifier } from '../../utils';
import { hash, hash_verify } from '../../auth/utils';

import { BlockDirection, UserAction, WsNamespace } from '../../websockets/types';
import {
	ApiResponseError,
	UsersFriendship,
	NotifcationType,
	RelationType,
	RelationDispatch,
	UserStatus
} from '../types';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly picturesService: PicturesService,
		private readonly notifcationsService: NotifcationsService,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	//#region

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

	async findWithRelationsOrNull(where: object, error_msg: string): Promise<UsersInfos | null> {
		return this.usersRepository
			.createQueryBuilder('user')
			.where(where)
			.leftJoinAndSelect('user.friends', 'friends')
			.leftJoinAndSelect('user.blocklist', 'blocklist')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				this.logger.verbose(where);
				return null;
			});
	}

	async findWithRelations(where: object, error_msg: string): Promise<UsersInfos> {
		const user = await this.findWithRelationsOrNull(where, error_msg);
		if (!user) {
			throw new NotFoundException();
		}
		return user;
	}

	save(user: UsersInfos) {
		return this.usersRepository.save(user);
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

	isCurrentlyBlocked(current_user: UsersInfos, remote_user: UsersInfos) {
		return current_user.blocklist.map((user) => user.uuid).includes(remote_user.uuid);
	}

	isRemotelyBlocked(current_user: UsersInfos, remote_user: UsersInfos) {
		return remote_user.blocklist.map((user) => user.uuid).includes(current_user.uuid);
	}

	isBlocked(current_user: UsersInfos, remote_user: UsersInfos) {
		const isCurrentlyBlocked = this.isCurrentlyBlocked(current_user, remote_user);
		const isRemotelyBlocked = this.isRemotelyBlocked(current_user, remote_user);
		return isCurrentlyBlocked || isRemotelyBlocked;
	}
	//#endregion

	/**
	 * Service
	 */
	//#region

	async updateStatus(user: UsersInfos, status: UserStatus) {
		user.is_online = status;
		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update user status for user ' + user.uuid, e);
			throw new InternalServerErrorException();
		});
	}

	async create(params: SignupProperty) {
		const requests = await Promise.all([
			this.getIdentfier(params.username),
			hash(params.password, hash_password_config)
		]);
		const new_user = this.usersRepository.create({
			adam: params.adam ? true : false,
			identifier: params.identifier !== undefined ? params.identifier : requests[0],
			username: params.username,
			email: params.email,
			password: requests[1],
			twofactor: params.twofactor,
			is_online: UserStatus.Offline
		});

		let created_user = await this.usersRepository.save(new_user).catch((e) => {
			if (/email|exists/.test(e.detail)) {
				throw new BadRequestException(ApiResponseError.EmailTaken);
			} else {
				this.logger.error('Failed to insert user', e);
				throw new InternalServerErrorException();
			}
		});
		this.logger.debug('User created ' + new_user.uuid);

		if (params.avatar) {
			const hash = createHash('sha1').update(created_user.uuid).digest('hex');
			const avatar: string = await this.picturesService
				.download(hash, params.avatar)
				.catch((e) => {
					this.logger.error('Profile picture download failed', e);
					return null;
				});

			created_user = await this.usersRepository.save({ ...new_user, avatar }).catch((e) => {
				this.logger.error('Failed to update user profile picture', e);
				throw new InternalServerErrorException();
			});
			this.logger.debug('User profile picture set for ' + new_user.uuid);
		}

		return created_user;
	}

	async whoami(user: UsersInfos): Promise<UsersMeResponse> {
		return {
			uuid: user.uuid,
			identifier: user.identifier,
			username: user.username,
			email: user.email,
			twofactor: user.twofactor !== null,
			avatar: user.avatar,
			adam: user.adam ? true : undefined
		};
	}

	public readonly get = {
		format: (current_user: UsersInfos, remote_user: UsersInfos) => {
			const state = this.wsService.getUserStatus(remote_user.uuid);
			return {
				uuid: remote_user.uuid,
				identifier: remote_user.identifier,
				username: remote_user.username,
				avatar: remote_user.avatar,
				is_online: state.status,
				lobby: state.status === UserStatus.InGame ? state.lobby : undefined,
				friendship: this.usersAreFriends(current_user, remote_user),
				is_blocked: this.isCurrentlyBlocked(current_user, remote_user),
				has_blocked: this.isRemotelyBlocked(current_user, remote_user)
			};
		},
		ByUUID: async (
			current_user: UsersInfos,
			remote_user_uuid: string
		): Promise<UsersGetResponse> => {
			const remote_user = await this.findWithRelations(
				{ uuid: remote_user_uuid },
				'Unable to find user by uuid ' + remote_user_uuid
			);

			return this.get.format(current_user, remote_user);
		},
		ByIdentifier: async (
			current_user: UsersInfos,
			remote_username: string,
			remote_identifier: number
		): Promise<UsersGetResponse> => {
			const remote_user = await this.findWithRelations(
				{ identifier: remote_identifier, username: remote_username },
				'Unable to find user by identifier ' + remote_username + '#' + remote_identifier
			);

			return this.get.format(current_user, remote_user);
		}
	};

	async avatar(user: UsersInfos, filename: string) {
		const old_avatar = user.avatar;
		user.avatar = filename;

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update avatar for user ' + user.uuid, e);
			throw new InternalServerErrorException();
		});

		this.wsService.updateClient({ user });
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
			throw new BadRequestException(ApiResponseError.ConfirmMismatch);
		}

		if (current_password === new_password) {
			throw new BadRequestException(ApiResponseError.PasswordsIdentical);
		}

		const verif = await hash_verify(user.password, current_password);
		if (!verif) {
			throw new BadRequestException(ApiResponseError.PasswordMismatch);
		}

		user.password = await hash(new_password, hash_password_config);

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update password for user ' + user.uuid, e);
			throw new BadRequestException();
		});
	}

	public readonly relations = {
		dispatch: async (
			type: RelationType,
			action: RelationDispatch,
			current_user: UsersInfos,
			remote_user_uuid: string
		) => {
			if (current_user.uuid === remote_user_uuid) {
				switch (type) {
					case RelationType.Friends:
						throw new BadRequestException(ApiResponseError.FriendYourself);
					case RelationType.Blocklist:
						throw new BadRequestException(ApiResponseError.BlockYourself);
				}
			}

			const remote_user = await this.findWithRelations(
				{ uuid: remote_user_uuid },
				'Unable to find remote user in relation' + remote_user_uuid
			);

			const notifcation_type = [
				NotifcationType.FriendRequest,
				NotifcationType.AcceptedFriendRequest
			];
			await this.notifcationsService.read.ByType(current_user, remote_user, notifcation_type);

			switch (type) {
				case RelationType.Friends:
					switch (action) {
						case RelationDispatch.Add:
							return await this.relations.friends.add(current_user, remote_user);
						case RelationDispatch.Remove:
							await this.notifcationsService.read.ByType(
								remote_user,
								current_user,
								notifcation_type
							);
							return await this.relations.friends.remove(current_user, remote_user);
					}
				case RelationType.Blocklist:
					switch (action) {
						case RelationDispatch.Add:
							await this.notifcationsService.read.ByType(
								remote_user,
								current_user,
								notifcation_type
							);
							return await this.relations.blocklist.add(current_user, remote_user);
						case RelationDispatch.Remove:
							return await this.relations.blocklist.remove(current_user, remote_user);
					}
			}
		},
		get: async (user: UsersInfos): Promise<UsersRelationsResponse> => {
			const users = user.friends;
			const blocked = user.blocklist;

			let friendship: UsersFriendshipResponse[] = [];
			for (let remote_user of users) {
				remote_user = await this.findWithRelationsOrNull(
					{ uuid: remote_user.uuid },
					'Unable to find remote user ' + remote_user.uuid
				);
				if (!remote_user) {
					this.logger.error('This should not happen');
					continue;
				}

				const friendship_status = this.usersAreFriends(user, remote_user);
				if (!friendship_status) {
					continue;
				}

				friendship.push({
					uuid: remote_user.uuid,
					friendship: friendship_status
				});
			}

			const blocklist: Array<string> = blocked.map((u) => u.uuid);

			return {
				friendship,
				blocklist
			};
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

				this.wsService.updateClient({ user: current_user });
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

				this.wsService.dispatch.user(current_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Unfriend,
					user: remote_user.uuid
				});
				this.wsService.dispatch.user(remote_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Unfriend,
					user: current_user.uuid
				});
				this.wsService.updateClient({ user: current_user });
			}
		},
		blocklist: {
			add: async (current_user: UsersInfos, remote_user: UsersInfos) => {
				if (this.isCurrentlyBlocked(current_user, remote_user)) {
					throw new BadRequestException(ApiResponseError.AlreadyBlocked);
				}

				await this.relations.friends.remove(current_user, remote_user);

				current_user.addBlocklist(remote_user);
				await this.usersRepository.save(current_user).catch((e) => {
					this.logger.error('Unable to update blocklist of user ' + current_user.uuid, e);
					throw new InternalServerErrorException();
				});

				this.wsService.dispatch.user(current_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Block,
					user: remote_user.uuid,
					direction: BlockDirection.IsBlocked
				});
				this.wsService.dispatch.user(remote_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Block,
					user: current_user.uuid,
					direction: BlockDirection.HasBlocked
				});
				this.wsService.updateClient({ user: current_user });
			},
			remove: async (current_user: UsersInfos, remote_user: UsersInfos) => {
				if (!this.isCurrentlyBlocked(current_user, remote_user)) {
					throw new BadRequestException(ApiResponseError.NotBlocked);
				}

				current_user.blocklist = current_user.blocklist.filter(
					(user) => user.uuid !== remote_user.uuid
				);

				await this.usersRepository.save(current_user).catch((e) => {
					this.logger.error(
						'Unable to remove block of users ' +
							remote_user.uuid +
							' for ' +
							current_user.uuid,
						e
					);
					throw new InternalServerErrorException();
				});

				this.wsService.dispatch.user(current_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Unblock,
					user: remote_user.uuid,
					direction: BlockDirection.IsUnblocked
				});
				this.wsService.dispatch.user(remote_user.uuid, {
					namespace: WsNamespace.User,
					action: UserAction.Unblock,
					user: current_user.uuid,
					direction: BlockDirection.HasUnblocked
				});
				this.wsService.updateClient({ user: current_user });
			}
		}
	};
	//#endregion
}
