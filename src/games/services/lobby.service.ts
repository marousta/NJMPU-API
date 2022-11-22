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
import { Repository } from 'typeorm';

import { NotifcationsService } from '../../users/services/notifications.service';
import { WsService } from '../../websockets/ws.service';

import { GamesLobby } from '../entities/lobby';
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
import { GameAction, WebSocketUser, WsNamespace } from '../../websockets/types';

@Injectable()
export class GamesLobbyService {
	private readonly logger = new Logger(GamesLobbyService.name);
	private readonly lobbies: { [uuid: string]: GamesLobby } = {};
	private waiting_loop: NodeJS.Timer = null;
	constructor(
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

	private findWithRelationsOrNull(uuid: string): GamesLobby | null {
		return this.lobbies[uuid] ?? null;
	}

	private findAllWithRelations(): GamesLobby[] | null {
		return Object.entries(this.lobbies).map(([key, lobby]) => lobby);
	}

	private findWithRelations(uuid: string): GamesLobby {
		const lobby = this.findWithRelationsOrNull(uuid);
		if (!lobby) {
			throw new NotFoundException(ApiResponseError.LobbyNotFound);
		}

		return lobby;
	}

	private findInLobby(user_uuid: string): GamesLobby[] {
		const lobbies = Object.values(this.lobbies)
			.map((lobby) => lobby)
			.filter(
				(lobby) => lobby.player1.uuid === user_uuid || lobby.player2?.uuid === user_uuid
			);
		return lobbies.length !== 0 ? lobbies : null;
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

	private isSpectator(lobby: GamesLobby, user: UsersInfos) {
		return lobby.spectators.map((u) => u.uuid).includes(user.uuid);
	}

	private unsetSpectator(jwt: JwtData, lobby: GamesLobby) {
		return lobby.spectators_ws
			.map((client) => {
				if (client.jwt.infos.uuid !== jwt.infos.uuid) {
					this.wsService.unsetLobby(jwt, client.uuid);
				}
				return client;
			})
			.filter((client) => client.jwt.infos.uuid !== jwt.infos.uuid);
	}

	removeFromLobbies(jwt: JwtData) {
		const current_user = jwt.infos;

		const old_lobby = this.findInLobby(current_user.uuid);
		if (!old_lobby) {
			return;
		}

		for (const old of old_lobby) {
			this.lobby.delete(jwt, old);
		}
	}

	getUsers(lobby: GamesLobby) {
		const spectators = lobby.spectators ? lobby.spectators.map((u) => u.uuid) : [];
		return [lobby.player1.uuid, lobby.player2?.uuid, ...spectators];
	}

	//#endregion

	/**
	 * Service
	 */
	//#region

	public readonly lobby = {
		get: (uuid: string): GamesLobbyGetResponse => {
			const lobby = this.findWithRelations(uuid);

			return this.formatResponse(lobby);
		},
		getAll: (): GamesLobbyGetResponse[] | {} => {
			const lobbies = this.findAllWithRelations();

			if (!lobbies) {
				return {};
			}

			return lobbies.map((lobby) => {
				return this.formatResponse(lobby);
			});
		},
		create: async (jwt: JwtData, websocket_uuid: string, remote_user?: UsersInfos) => {
			const current_user = jwt.infos;

			this.removeFromLobbies(jwt);

			const lobby = new GamesLobby({
				in_game: false,
				player1: current_user,
				player1_status: LobbyPlayerReadyState.Joined,
				player2: remote_user,
				player2_status: LobbyPlayerReadyState.Invited
			});

			lobby.player1_ws = this.wsService.setLobby(jwt, websocket_uuid, lobby.uuid, false);
			if (!lobby.player1_ws) {
				throw new BadRequestException(ApiResponseError.NoConnection);
			}

			this.lobbies[lobby.uuid] = lobby;

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Join,
				lobby_uuid: lobby.uuid,
				user_uuid: current_user.uuid
			});

			await this.wsService.updateUserStatus(jwt.infos, UserStatus.InGame, lobby.uuid);

			return lobby;
		},
		createMatch: async (current_client: WebSocketUser, remote_client: WebSocketUser) => {
			const current_jwt = current_client.jwt;
			const remote_jwt = remote_client.jwt;
			const current_user = current_jwt.infos;
			const remote_user = remote_jwt.infos;

			this.removeFromLobbies(current_jwt);
			this.removeFromLobbies(remote_jwt);

			const lobby = new GamesLobby({
				in_game: false,
				matchmaking: true,
				player1: current_user,
				player1_status: LobbyPlayerReadyState.Joined,
				player2: remote_user,
				player2_status: LobbyPlayerReadyState.Joined
			});

			lobby.player1_ws = this.wsService.setLobby(
				current_jwt,
				current_client.uuid,
				lobby.uuid,
				false
			);
			lobby.player2_ws = this.wsService.setLobby(
				remote_jwt,
				remote_client.uuid,
				lobby.uuid,
				false
			);
			if (!lobby.player1_ws || !lobby.player2_ws) {
				throw new BadRequestException(ApiResponseError.NoConnection);
			}

			this.lobbies[lobby.uuid] = lobby;

			this.wsService.dispatch.client([current_client, remote_client], {
				namespace: WsNamespace.Game,
				action: GameAction.Match,
				lobby: this.formatResponse(lobby)
			});

			// For front compatibility
			this.wsService.dispatch.lobby(
				lobby,
				{
					namespace: WsNamespace.Game,
					action: GameAction.Join,
					lobby_uuid: lobby.uuid,
					user_uuid: current_user.uuid
				},
				[lobby.player1_ws.uuid, lobby.player2_ws.uuid]
			);
			this.wsService.dispatch.lobby(
				lobby,
				{
					namespace: WsNamespace.Game,
					action: GameAction.Invite,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				},
				[lobby.player1_ws.uuid, lobby.player2_ws.uuid]
			);
			this.wsService.dispatch.lobby(
				lobby,
				{
					namespace: WsNamespace.Game,
					action: GameAction.Join,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				},
				[lobby.player1_ws.uuid, lobby.player2_ws.uuid]
			);

			await this.wsService.updateUserStatus(lobby.player1, UserStatus.InGame, lobby.uuid);
			await this.wsService.updateUserStatus(lobby.player2, UserStatus.InGame, lobby.uuid);
		},
		createFormat: async (jwt: JwtData, websocket_uuid: string, remote_user?: UsersInfos) => {
			const lobby = await this.lobby.create(jwt, websocket_uuid, remote_user);
			return this.formatResponse(lobby);
		},
		addPlayer: (lobby: GamesLobby, user: UsersInfos) => {
			lobby.player2 = user;
			this.lobbies[lobby.uuid] = lobby;
			return lobby;
		},
		invite: async (jwt: JwtData, websocket_uuid: string, remote_user_uuid: string) => {
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

			const existing_lobbies: Array<GamesLobby> = this.findInLobby(current_user.uuid);

			// Check if user in already in lobby
			let lobby: GamesLobby = null;
			if (existing_lobbies?.length > 1) {
				// User is in several lobbies
				this.logger.error('User ' + remote_user.uuid + ' is in several lobbies');
				throw new InternalServerErrorException();
			} else if (existing_lobbies?.length === 1) {
				// Add user to existing lobby (it was in spectator)
				lobby = this.lobby.addPlayer(existing_lobbies[0], remote_user);
			} else {
				// User not in lobby, creating one
				lobby = await this.lobby.create(jwt, websocket_uuid, remote_user);
			}

			await this.notifcationsService.add(
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
		join: async (jwt: JwtData, uuid: string, websocket_uuid: string) => {
			const remote_user = jwt.infos;
			const lobby = this.findWithRelations(uuid);

			if (lobby.player1.uuid === remote_user.uuid) {
				throw new BadRequestException(ApiResponseError.AlreadyIn);
			}

			const was_spectator = this.isSpectator(lobby, remote_user);
			let is_spectator = false;

			if (!lobby.player2 || lobby.player2.uuid !== remote_user.uuid) {
				if (was_spectator) {
					throw new BadRequestException(ApiResponseError.AlreadyIn);
				}

				if (lobby.spectators.length > max_spectators) {
					throw new BadRequestException(ApiResponseError.GameFull);
				}

				lobby.addSpectator(remote_user);

				const client = this.wsService.setLobby(jwt, websocket_uuid, lobby.uuid, true);
				if (!client) {
					throw new BadRequestException(ApiResponseError.NoConnection);
				}
				lobby.addSpectatorWs(client);

				is_spectator = true;
			} else if (lobby.player2.uuid === remote_user.uuid) {
				lobby.player2_status = LobbyPlayerReadyState.Joined;

				lobby.player2_ws = this.wsService.setLobby(
					jwt,
					websocket_uuid,
					lobby.uuid,
					is_spectator
				);
				if (!lobby.player2_ws) {
					throw new BadRequestException(ApiResponseError.NoConnection);
				}

				await this.wsService.updateUserStatus(lobby.player2, UserStatus.InGame, lobby.uuid);

				if (was_spectator) {
					lobby.spectators = lobby.spectators.filter((u) => u.uuid !== remote_user.uuid);
					lobby.spectators_ws = lobby.spectators_ws.filter(
						(u) => u.uuid !== websocket_uuid
					);
				}
			}

			this.lobbies[lobby.uuid] = lobby;

			if (!lobby.player2 || lobby.player2.uuid !== remote_user.uuid) {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Spectate,
					lobby_uuid: lobby.uuid,
					user_uuid: remote_user.uuid
				});
			} else {
				if (was_spectator) {
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
		start: (jwt: JwtData, uuid: string) => {
			const user = jwt.infos;
			const lobby = this.findWithRelations(uuid);

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

			this.lobbies[lobby.uuid] = lobby;

			if (lobby.in_game) {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Start,
					lobby_uuid: lobby.uuid
				});

				// TODO: Game
			} else {
				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Ready,
					lobby_uuid: lobby.uuid,
					user_uuid: user.uuid
				});
			}
		},
		delete: async (jwt: JwtData, lobby: GamesLobby, is_leaving?: boolean) => {
			const current_user = jwt.infos;

			const was_spectator = this.isSpectator(lobby, current_user);
			if (
				!was_spectator &&
				(lobby.player1.uuid === current_user.uuid || lobby.in_game || lobby.matchmaking)
			) {
				//TODO: Game history

				this.wsService.dispatch.lobby(lobby, {
					namespace: WsNamespace.Game,
					action: GameAction.Disband,
					lobby_uuid: lobby.uuid
				});
				this.wsService.unsetAllLobby(lobby);

				await this.wsService.updateUserStatus(lobby.player1, UserStatus.Online);
				if (lobby.player2) {
					await this.notifcationsService.read.ByRelation(
						lobby.player1.uuid,
						lobby.player2.uuid
					);
					await this.wsService.updateUserStatus(lobby.player2, UserStatus.Online);
				}

				delete this.lobbies[lobby.uuid];
				this.logger.debug('Removed lobby ' + lobby.uuid);

				return true;
			}

			if (is_leaving) {
				return false;
			}

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Leave,
				lobby_uuid: lobby.uuid,
				user_uuid: current_user.uuid
			});
			if (was_spectator) {
				lobby.spectators_ws = this.unsetSpectator(jwt, lobby);
			} else {
				this.wsService.unsetLobby(jwt, lobby.player2_ws.uuid);
			}

			return false;
		},
		decline: async (jwt: JwtData, uuid: string) => {
			const current_user = jwt.infos;
			const lobby = this.findWithRelations(uuid);

			if (
				lobby.player2?.uuid !== current_user.uuid &&
				lobby.player2_status !== LobbyPlayerReadyState.Invited
			) {
				throw new BadRequestException(ApiResponseError.InvalidInvitation);
			}

			await this.notifcationsService.read.ByRelation(lobby.player1.uuid, lobby.player2.uuid);

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Decline,
				lobby_uuid: lobby.uuid,
				user_uuid: current_user.uuid
			});

			lobby.player2 = null;
			this.lobbies[lobby.uuid] = lobby;
		},
		leave: async (jwt: JwtData, uuid: string) => {
			const current_user = jwt.infos;
			const lobby = this.findWithRelations(uuid);

			const deleted = await this.lobby.delete(jwt, lobby, true);
			if (deleted) {
				return;
			}

			const was_spectator = this.isSpectator(lobby, current_user);
			if (!was_spectator && lobby.player2?.uuid === current_user.uuid) {
				lobby.player2 = null;
				lobby.player2_status = LobbyPlayerReadyState.Invited;

				this.wsService.unsetLobby(jwt, lobby.player2_ws.uuid);

				await this.wsService.updateUserStatus(current_user, UserStatus.Online);
			} else if (was_spectator) {
				lobby.spectators = lobby.spectators.filter((u) => u.uuid !== current_user.uuid);
				lobby.spectators_ws = this.unsetSpectator(jwt, lobby);
			} else {
				throw new ForbiddenException(ApiResponseError.NotInLobby);
			}

			this.lobbies[lobby.uuid] = lobby;

			this.wsService.dispatch.lobby(lobby, {
				namespace: WsNamespace.Game,
				action: GameAction.Leave,
				lobby_uuid: lobby.uuid,
				user_uuid: current_user.uuid
			});
		}
	};
	//#endregion
}
