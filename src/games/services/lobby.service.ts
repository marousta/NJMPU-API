import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException,
	ForbiddenException,
	Inject,
	forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getManager, Repository } from 'typeorm';

import { NotifcationsService } from '../../users/services/notifications.service';
import { WsService } from '../../websockets/ws.service';

import { GamesLobby } from '../entities/lobby.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { GamesLobbyGetResponse } from '../properties/lobby.get.property';

import { max_spectators } from '../config';

import {
	ApiResponseError as ApiResponseErrorUser,
	NotifcationType,
	UserStatus
} from '../../users/types';
import { ApiResponseError, LobbyPlayerReadyState } from '../types';
import { JwtData } from '../../auth/types';
import { GameAction, WsNamespace } from '../../websockets/types';

@Injectable()
export class GamesLobbyService {
	private readonly logger = new Logger(GamesLobbyService.name);
	constructor(
		@InjectRepository(GamesLobby)
		private readonly lobbyRepository: Repository<GamesLobby>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		@Inject(forwardRef(() => NotifcationsService))
		private readonly notifcationsService: NotifcationsService,
		@Inject(forwardRef(() => WsService))
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	//#region

	async findWithRelationsOrNull(where: object, error_msg: string): Promise<GamesLobby | null> {
		return this.lobbyRepository
			.createQueryBuilder('lobby')
			.where(where)
			.leftJoinAndSelect('lobby.player1', 'player1')
			.leftJoinAndSelect('lobby.player2', 'player2')
			.leftJoinAndSelect('lobby.spectators', 'spectators')
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				this.logger.verbose(JSON.stringify(where));
				return null;
			});
	}

	async findAllWithRelations(error_msg: string): Promise<GamesLobby[] | null> {
		return this.lobbyRepository
			.createQueryBuilder('lobby')
			.leftJoinAndSelect('lobby.player1', 'player1')
			.leftJoinAndSelect('lobby.player2', 'player2')
			.leftJoinAndSelect('lobby.spectators', 'spectators')
			.getMany()
			.then((r) => (r.length ? r : null))
			.catch((e) => {
				this.logger.verbose(error_msg, e);
				return null;
			});
	}

	async findWithRelations(where: object, error_msg: string): Promise<GamesLobby> {
		const lobby = await this.findWithRelationsOrNull(where, error_msg);
		if (!lobby) {
			throw new NotFoundException(ApiResponseError.LobbyNotFound);
		}

		return lobby;
	}

	private async findInLobby(uuid: string): Promise<GamesLobby[]> {
		return this.lobbyRepository
			.createQueryBuilder('lobby')
			.where({ player1: { uuid } })
			.orWhere({ player2: { uuid } })
			.leftJoinAndSelect('lobby.player1', 'player1')
			.leftJoinAndSelect('lobby.player2', 'player2')
			.leftJoinAndSelect('lobby.spectators', 'spectators')
			.getMany()
			.then((r) => (r.length ? r : null))
			.catch((e) => {
				this.logger.verbose('Unable to find duplicate lobby for user ' + uuid, e);
				return null;
			});
	}

	private formatResponse(lobby: GamesLobby): GamesLobbyGetResponse {
		return {
			uuid: lobby.uuid,
			in_game: lobby.in_game,
			players: [lobby.player1.uuid, lobby.player2 ? lobby.player2.uuid : null],
			players_status: [lobby.player1_status, lobby.player2_status],
			spectators: lobby.spectators?.map((u) => u.uuid),
			max_spectators
		};
	}

	/**
	 * Garbage collect leftover lobbies
	 */
	//#region

	// I'm very sorry for this function
	// TypeORM won't let me find an entity based on Many-To-Many relation uuid
	async RemoveSpectatorFromLobbies(current_user: UsersInfos) {
		// Manually getting all lobbies where the user is spectating
		const query_spectating_lobbies: Array<{ games_lobby_uuid: string }> =
			await this.lobbyRepository.manager.query(
				`SELECT games_lobby_uuid FROM public."games_lobby_spectators-users_infos" WHERE users_infos_uuid='${current_user.uuid}'`
			);

		// Convert raw query response to array of lobby uuid
		const spectating_lobbies = query_spectating_lobbies.map((lobby) => lobby.games_lobby_uuid);

		// Finally getting lobbies entities
		let lobbies_promises: Array<Promise<GamesLobby>> = [];
		for (const lobby_uuid of spectating_lobbies) {
			lobbies_promises.push(this.findWithRelationsOrNull({ uuid: lobby_uuid }, 'ignore'));
		}
		const lobbies = await Promise.all(lobbies_promises);

		// Removing user from lobbies spectators
		let spectator_remove_promises: Array<Promise<void>> = [];
		for (const lobby of lobbies) {
			// Filtering user from spectators
			lobby.spectators = lobby.spectators.filter((u) => u.uuid !== current_user.uuid);

			spectator_remove_promises.push(
				this.lobbyRepository
					.save(lobby)
					.then((r) => {
						// Debug
						this.logger.debug(
							'Removed spectator ' + current_user.uuid + ' from lobby ' + lobby.uuid
						);
					})
					.catch((e) => {
						this.logger.error(
							'Unable to remove spectator "+current_user.uuid+" from lobby ' +
								lobby.uuid,
							e
						);
					})
			);
		}
		await Promise.all(spectator_remove_promises);
	}

	// Garbage collector
	// This will theorically never clean more than one lobby
	async removeFromLobbies(jwt: JwtData) {
		const current_user = jwt.infos;

		await this.RemoveSpectatorFromLobbies(current_user);

		const old_lobby = await this.findInLobby(current_user.uuid);
		if (!old_lobby) {
			return;
		}

		let promises: Array<Promise<boolean>> = [];
		for (const old of old_lobby) {
			promises.push(this.lobby.delete(jwt, old));
		}
		await Promise.all(promises);
	}
	//#endregion

	//#endregion

	/**
	 * Service
	 */
	//#region

	public readonly lobby = {
		get: async (uuid: string): Promise<GamesLobbyGetResponse> => {
			const lobby = await this.findWithRelations(
				{ uuid },
				'Unable to find lobby for ' + uuid
			);

			return this.formatResponse(lobby);
		},
		getAll: async (): Promise<GamesLobbyGetResponse[] | {}> => {
			const lobbies = await this.findAllWithRelations('Unable to find lobbies');

			if (!lobbies) {
				return {};
			}

			return lobbies.map((lobby) => {
				return this.formatResponse(lobby);
			});
		},
		create: async (jwt: JwtData, remote_user?: UsersInfos) => {
			const current_user = jwt.infos;

			await this.removeFromLobbies(jwt);

			const lobby = this.lobbyRepository.create({
				in_game: false,
				player1: current_user,
				player1_status: LobbyPlayerReadyState.Joined,
				player2: remote_user,
				player2_status: LobbyPlayerReadyState.Invited
			});

			const new_lobby = await this.lobbyRepository.save(lobby).catch((e) => {
				if (remote_user) {
					this.logger.error(
						'Unable to create lobby for user ' +
							current_user.uuid +
							' and ' +
							remote_user.uuid,
						e
					);
				} else {
					this.logger.error('Unable to create lobby for user ' + current_user.uuid, e);
				}
				throw new InternalServerErrorException();
			});

			this.wsService.setLobby(jwt, new_lobby.uuid);
			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Join,
				lobby_uuid: lobby.uuid,
				user_uuid: current_user.uuid
			});

			return lobby;
		},
		createFormat: async (jwt: JwtData, remote_user?: UsersInfos) => {
			const lobby = await this.lobby.create(jwt, remote_user);
			return this.formatResponse(lobby);
		},
		addPlayer: async (lobby: GamesLobby, user: UsersInfos) => {
			lobby.player2 = user;
			await this.lobbyRepository.save(lobby).catch((e) => {
				this.logger.error('Unable to add player 2 to lobby ' + lobby.uuid, e);
				throw new InternalServerErrorException();
			});
			return lobby;
		},
		invite: async (jwt: JwtData, remote_user_uuid: string) => {
			const current_user = jwt.infos;
			if (current_user.uuid === remote_user_uuid) {
				throw new BadRequestException(ApiResponseErrorUser.InteractYourself);
			}

			const promises = await Promise.all([
				this.usersRepository.findOneByOrFail({ uuid: remote_user_uuid }).catch((e) => {
					this.logger.verbose('Unable to find remote user ' + remote_user_uuid, e);
					throw new NotFoundException(ApiResponseErrorUser.NotFound);
				}),
				this.findInLobby(current_user.uuid)
			]);
			const remote_user = promises[0];
			const existing_lobbies: any = promises[1];

			// Check if user in already in lobby
			let lobby: GamesLobby = null;
			if (existing_lobbies?.length > 1) {
				// User is in several lobbies
				this.logger.error('User ' + remote_user.uuid + ' is in several lobbies');
				throw new InternalServerErrorException();
			} else if (existing_lobbies?.length === 1) {
				// Add user to existing lobby (it was in spectator)
				lobby = await this.lobby.addPlayer(existing_lobbies[0], remote_user);
			} else {
				// User not in lobby, creating one
				lobby = await this.lobby.create(jwt, remote_user);
			}

			this.notifcationsService.add(
				NotifcationType.GameInvite,
				current_user,
				remote_user,
				lobby.uuid
			);
			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Invite,
				lobby_uuid: lobby.uuid,
				user_uuid: remote_user_uuid
			});

			return this.formatResponse(lobby);
		},
		join: async (jwt: JwtData, uuid: string) => {
			const remote_user = jwt.infos;
			const lobby = await this.findWithRelations({ uuid }, 'Unable to find lobby ' + uuid);

			if (lobby.player1.uuid === remote_user.uuid) {
				throw new BadRequestException(ApiResponseError.AlreadyIn);
			}

			let wasSpectator = lobby.spectators.map((u) => u.uuid).includes(remote_user.uuid);

			if (!lobby.player2 || lobby.player2.uuid !== remote_user.uuid) {
				if (wasSpectator) {
					throw new BadRequestException(ApiResponseError.AlreadyIn);
				}
				if (lobby.spectators.length > max_spectators) {
					throw new BadRequestException(ApiResponseError.GameFull);
				}
				lobby.addSpectator(remote_user);
			} else if (lobby.player2.uuid === remote_user.uuid) {
				lobby.player2_status = LobbyPlayerReadyState.Joined;

				if (wasSpectator) {
					lobby.spectators.filter((u) => u.uuid !== remote_user.uuid);
				}
			}

			await this.lobbyRepository.save(lobby).catch((e) => {
				this.logger.error(
					'Unable to join lobby ' + uuid + ' for remote user ' + remote_user.uuid,
					e
				);
				throw new InternalServerErrorException();
			});

			this.wsService.setLobby(jwt, lobby.uuid);
			if (!lobby.player2 || lobby.player2.uuid !== remote_user.uuid) {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Spectate,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				});
			} else {
				if (wasSpectator) {
					this.wsService.dispatch.lobby(lobby, {
						namespace: WsNamespace.Game,
						action: GameAction.Leave,
						lobby_uuid: lobby.uuid,
						user_uuid: remote_user.uuid
					});
				}
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Join,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				});
			}
			await this.notifcationsService.read.ByRelation(lobby.player1.uuid, remote_user.uuid);

			return this.formatResponse(lobby);
		},
		start: async (jwt: JwtData, uuid: string) => {
			const user = jwt.infos;
			const lobby = await this.findWithRelations({ uuid }, 'Unable to find lobby ' + uuid);

			switch (user.uuid) {
				case lobby.player1.uuid:
					lobby.player1_status = LobbyPlayerReadyState.Ready;
					break;
				case lobby.player2.uuid:
					lobby.player2_status = LobbyPlayerReadyState.Ready;
					break;
				default:
					throw new ForbiddenException(ApiResponseError.NotInLobby);
			}

			if (
				lobby.player1_status === LobbyPlayerReadyState.Ready &&
				lobby.player2_status === LobbyPlayerReadyState.Ready
			) {
				lobby.in_game = true;
			}

			await this.lobbyRepository.save(lobby).catch((e) => {
				this.logger.error('Unable to start game for lobby ' + uuid, e);
				throw new InternalServerErrorException();
			});

			if (lobby.in_game) {
				this.wsService.updateUserStatus(lobby.player1, UserStatus.InGame, lobby.uuid);
				this.wsService.updateUserStatus(lobby.player2, UserStatus.InGame, lobby.uuid);
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Start,
					lobby_uuid: lobby.uuid
				});
			} else {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Ready,
					lobby_uuid: lobby.uuid,
					user_uuid: user.uuid
				});
			}
		},
		delete: async (jwt: JwtData, lobby: GamesLobby) => {
			await this.notifcationsService.read.ByRelation(lobby.player1.uuid, lobby.player2.uuid);

			if (lobby.player1.uuid === jwt.infos.uuid || lobby.in_game) {
				//TODO: Game history
				await this.lobbyRepository.delete(lobby.uuid).catch((e) => {
					this.logger.error('Unable to delete lobby ' + lobby.uuid, e);
					throw new InternalServerErrorException();
				});

				this.logger.debug('Removed lobby ' + lobby.uuid);

				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Disband,
					lobby_uuid: lobby.uuid
				});

				this.wsService.updateUserStatus(lobby.player1, UserStatus.Online);
				if (lobby.player2) {
					this.wsService.updateUserStatus(lobby.player2, UserStatus.Online);
				}

				return true;
			}

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Leave,
				lobby_uuid: lobby.uuid,
				user_uuid: jwt.infos.uuid
			});
			return false;
		},
		leave: async (jwt: JwtData, uuid: string) => {
			const user = jwt.infos;
			const lobby = await this.findWithRelations(
				{ uuid },
				'Unable to find lobby for ' + uuid
			);

			if (await this.lobby.delete(jwt, lobby)) {
				return;
			}

			if (lobby.player2?.uuid === user.uuid) {
				lobby.player2 = null;
				lobby.player2_status = LobbyPlayerReadyState.Invited;
			} else if (lobby.spectators.map((u) => u.uuid).includes(user.uuid)) {
				lobby.spectators = lobby.spectators.filter((u) => u.uuid !== user.uuid);
			} else {
				throw new ForbiddenException(ApiResponseError.NotInLobby);
			}

			await this.lobbyRepository.save(lobby).catch((e) => {
				this.logger.error(
					'Unable to remove user ' + user.uuid + ' from lobby ' + lobby.uuid,
					e
				);
				throw new InternalServerErrorException();
			});

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Leave,
				lobby_uuid: lobby.uuid,
				user_uuid: user.uuid
			});
		}
	};
	//#endregion
}
