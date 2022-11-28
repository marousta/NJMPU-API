import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WsService } from '../../websockets/ws.service';

import { GamesHistory } from '../entities/history.entity';
import { UsersInfos } from '../../users/entities/users.entity';
import { GamesLobbyFinished } from '../entities/lobby';

import { GamesHistoryGetResponse } from '../properties/history.get.property';

import { ApiResponseError as ApiResponseErrorUser } from '../../users/types';
import { LobbyWinner } from '../types';
import { GameAction, WsNamespace } from '../../websockets/types';

@Injectable()
export class GamesHistoryService {
	private readonly logger = new Logger(GamesHistoryService.name);
	constructor(
		@InjectRepository(GamesHistory)
		private readonly historyRepository: Repository<GamesHistory>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		@Inject(forwardRef(() => WsService))
		private readonly wsService: WsService,
	) {}

	/**
	 * Utils
	 */
	//#region

	async findAllByUser(uuid: string) {
		return this.historyRepository
			.createQueryBuilder('history')
			.where({ player1: { uuid } })
			.orWhere({ player2: { uuid } })
			.leftJoinAndSelect('history.player1', 'player1')
			.leftJoinAndSelect('history.player2', 'player2')
			.orderBy('creation_date', 'DESC')
			.getMany()
			.catch((e) => {
				this.logger.error('Unable to find games history for ' + uuid, e);
				throw new InternalServerErrorException();
			});
	}

	chooseWinner(lobby: GamesLobbyFinished): LobbyWinner {
		if (lobby.player1_score > lobby.player2_score) {
			return LobbyWinner.Player1;
		} else if (lobby.player1_score < lobby.player2_score) {
			return LobbyWinner.Player2;
		} else {
			return LobbyWinner.Tie;
		}
	}

	//#endregion

	/**
	 * Service
	 */
	//#region

	async get(uuid: string, current_user: boolean): Promise<GamesHistoryGetResponse[]> {
		if (!current_user) {
			await this.usersRepository.findOneByOrFail({ uuid }).catch((e) => {
				this.logger.verbose('Unable to find remote user ' + uuid, e);
				throw new NotFoundException(ApiResponseErrorUser.NotFound);
			});
		}

		const history = await this.findAllByUser(uuid);
		if (!history.length) {
			return [];
		}
		return history.map((h) => {
			return {
				uuid: h.uuid,
				winner: h.winner,
				players_scores: [h.player1_score, h.player2_score],
				players: [h.player1.uuid, h.player2.uuid],
			};
		});
	}

	// Awful hack
	async create(lobby: GamesLobbyFinished, left_user_uuid?: string) {
		let winner: LobbyWinner = null;

		if (left_user_uuid) {
			if (lobby.player1.uuid === left_user_uuid) {
				winner = LobbyWinner.Player2;
			} else if (lobby.player2.uuid === left_user_uuid) {
				winner = LobbyWinner.Player1;
			}
		}

		if (winner === null) {
			winner = this.chooseWinner(lobby);
		}

		lobby.winner = winner;

		await this.historyRepository.save(lobby).catch((e) => {
			this.logger.error('Unable to create game history for lobby ' + lobby.uuid, e);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.lobby(lobby, {
			namespace: WsNamespace.Game,
			action: GameAction.End,
			history: {
				uuid: lobby.uuid,
				players: [lobby.player1.uuid, lobby.player2.uuid],
				players_scores: [lobby.player1_score, lobby.player2_score],
				winner,
			} as GamesHistoryGetResponse,
		});
	}

	//#endregion
}
