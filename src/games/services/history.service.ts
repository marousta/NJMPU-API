import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NotifcationsService } from '../../users/services/notifications.service';

import { GamesHistory } from '../entities/history.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { ApiResponseError as ApiResponseErrorUser, NotifcationType } from '../../users/types';
import { GamesLobbyGetResponse } from '../properties/lobby.get.property';
import { ApiResponseError, LobbyPlayerReadyState, LobbyWinner } from '../types';
import { WsService } from '../../websockets/ws.service';
import { ForbiddenException } from '@nestjs/common';
import { GamesHistoryGetResponse } from '../properties/history.get.property';
import { GamesLobbyFinished } from '../entities/lobby.entity';

@Injectable()
export class GamesHistoryService {
	private readonly logger = new Logger(GamesHistoryService.name);
	constructor(
		@InjectRepository(GamesHistory)
		private readonly historyRepository: Repository<GamesHistory>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly notifcationsService: NotifcationsService,
		private readonly wsService: WsService
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
			.getMany()
			.catch((e) => {
				this.logger.error('Unable to find games history for ' + uuid, e);
				throw new InternalServerErrorException();
			});
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
				players: [h.player1.uuid, h.player2.uuid]
			};
		});
	}

	async create(lobby: GamesLobbyFinished) {
		let winner: LobbyWinner;
		if (lobby.player1_score === lobby.player2_score) {
			winner = LobbyWinner.Tie;
		} else if (lobby.player1_score > lobby.player2_score) {
			winner = LobbyWinner.Player1;
		} else if (lobby.player1_score < lobby.player2_score) {
			winner = LobbyWinner.Player2;
		} else {
			// This cancels lobby removal if an unexpected error happens,
			// data is still in database to allow a manual fix
			this.logger.warn('Unable to determine winner of lobby ' + lobby.uuid);
			return null;
		}

		const history = this.historyRepository.create({
			winner,
			player1: lobby.player1,
			player2: lobby.player2,
			player1_score: lobby.player1_score,
			player2_score: lobby.player2_score
		});

		return await this.historyRepository
			.save(history)
			.then((r) => {
				return true;
			})
			.catch((e) => {
				this.logger.error('Unable to create game history for lobby ' + lobby.uuid, e);
				return null;
			});
	}

	//#endregion
}
