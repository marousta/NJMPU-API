import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException,
	ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotifcationsService } from '../../users/services/notifications.service';
import { WsService } from '../../websockets/ws.service';

import { GamesLobby } from '../entities/lobby.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { GamesLobbyGetResponse } from '../properties/lobby.get.property';

import { ApiResponseError as ApiResponseErrorUser, NotifcationType } from '../../users/types';
import { ApiResponseError, LobbyPlayerReadyState } from '../types';
import { JwtData } from '../../auth/types';
import { GameAction, WsNamespace } from 'src/websockets/types';

import { max_spectators } from '../config';

@Injectable()
export class GamesLobbyService {
	private readonly logger = new Logger(GamesLobbyService.name);
	constructor(
		@InjectRepository(GamesLobby)
		private readonly lobbyRepository: Repository<GamesLobby>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly notifcationsService: NotifcationsService,
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
				this.logger.verbose(where);
				return null;
			});
	}

	async findAllWithRelations(error_msg: string): Promise<GamesLobby[] | null> {
		return this.lobbyRepository
			.createQueryBuilder('lobby')
			.leftJoinAndSelect('lobby.player1', 'player1')
			.leftJoinAndSelect('lobby.player2', 'player2')
			.leftJoinAndSelect('lobby.spectators', 'spectators')
			.getOneOrFail()
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
	//#endregion

	private async removeFromLobbies(jwt: JwtData) {
		const current_user = jwt.infos;

		let promises = [];
		const old_lobby = await this.findInLobby(current_user.uuid);
		if (!old_lobby) {
			return;
		}
		for (const old of old_lobby) {
			console.log(old.uuid);
			promises.push(this.lobby.delete(jwt, old.uuid, old));
		}
		await Promise.all(promises);
	}
	/**
	 * Service
	 */
	//#region

	// TODO: update lobby on user disconnect
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

			return this.formatResponse(lobby);
		},
		invite: async (jwt: JwtData, remote_user_uuid: string) => {
			const current_user = jwt.infos;
			if (current_user.uuid === remote_user_uuid) {
				throw new BadRequestException(ApiResponseErrorUser.InteractYourself);
			}

			const remote_user = await this.usersRepository
				.findOneByOrFail({ uuid: remote_user_uuid })
				.catch((e) => {
					this.logger.verbose('Unable to find remote user ' + remote_user_uuid, e);
					throw new NotFoundException(ApiResponseErrorUser.NotFound);
				});

			const lobby_response = await this.lobby.create(jwt, remote_user);

			this.notifcationsService.add(NotifcationType.GameInvite, current_user, remote_user);

			return lobby_response;
		},
		join: async (jwt: JwtData, uuid: string) => {
			const remote_user = jwt.infos;
			const lobby = await this.findWithRelations({ uuid }, 'Unable to find lobby ' + uuid);

			if (
				lobby.player1.uuid === remote_user.uuid ||
				lobby.spectators.map((u) => u.uuid).includes(remote_user.uuid)
			) {
				throw new BadRequestException(ApiResponseError.AlreadyIn);
			}

			if (lobby.player2.uuid === remote_user.uuid) {
				lobby.player2_status = LobbyPlayerReadyState.Joined;
			} else {
				if (lobby.spectators.length > max_spectators) {
					throw new BadRequestException(ApiResponseError.GameFull);
				}
				lobby.addSpectator(remote_user);
			}

			await this.lobbyRepository.save(lobby).catch((e) => {
				this.logger.error(
					'Unable to join lobby ' + uuid + ' for remote user ' + remote_user.uuid,
					e
				);
				throw new InternalServerErrorException();
			});

			this.wsService.setLobby(jwt, lobby.uuid);
			if (lobby.player2.uuid === remote_user.uuid) {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Join,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				});
			} else {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Spectate,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				});
			}

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

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Start,
				lobby_uuid: lobby.uuid
			});
		},
		delete: async (jwt: JwtData, uuid: string, lobby?: GamesLobby) => {
			const user = jwt.infos;
			if (!lobby) {
				lobby = await this.findWithRelations({ uuid }, 'Unable to find lobby for ' + uuid);
			}

			if (lobby.player1.uuid === user.uuid) {
				await this.lobbyRepository.delete(lobby.uuid).catch((e) => {
					this.logger.error('Unable to delete lobby ' + lobby.uuid, e);
					throw new InternalServerErrorException();
				});
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Leave,
					lobby_uuid: lobby.uuid,
					user_uuid: user.uuid
				});
				return;
			}

			if (lobby.player2.uuid === user.uuid) {
				lobby.player2 = null;
			} else if (lobby.spectators.includes(user)) {
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
