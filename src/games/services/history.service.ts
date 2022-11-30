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

import { UsersService } from '../../users/services/users.service';
import { WsService } from '../../websockets/ws.service';

import { GamesHistory } from '../entities/history.entity';
import { GamesLobbyFinished } from '../entities/lobby';

import { GamesHistoryGetResponse } from '../properties/history.get.property';

import { LobbyWinner } from '../types';
import { GameAction, WsNamespace } from '../../websockets/types';

import { PongRanking } from '../logic/ranking';

@Injectable()
export class GamesHistoryService {
	private readonly logger = new Logger(GamesHistoryService.name);
	private readonly ranking = new PongRanking();
	constructor(
		@InjectRepository(GamesHistory)
		private readonly historyRepository: Repository<GamesHistory>,
		@Inject(forwardRef(() => UsersService))
		private readonly usersService: UsersService,
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
			await this.usersService.findWithRelations(
				{ uuid },
				'Unable to find remote user ' + uuid,
			);
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
				players_xp: [h.player1_xp, h.player2_xp],
			};
		});
	}

	async updateXP(
		lobby: GamesLobbyFinished,
		winner: LobbyWinner,
		left: boolean,
	): Promise<[number, number]> {
		let xp: [number, number] = [0, 0];
		switch (winner) {
			case LobbyWinner.Player1:
				xp = [
					this.ranking.getXP(lobby.player1_score, true, lobby.matchmaking),
					this.ranking.getXP(lobby.player2_score, false, lobby.matchmaking),
				];
				break;
			case LobbyWinner.Player2:
				xp = [
					this.ranking.getXP(lobby.player1_score, false, lobby.matchmaking),
					this.ranking.getXP(lobby.player2_score, true, lobby.matchmaking),
				];
				break;
			default:
				xp = [
					this.ranking.getXP(lobby.player1_score, false, lobby.matchmaking),
					this.ranking.getXP(lobby.player2_score, false, lobby.matchmaking),
				];
		}

		if (left) {
			switch (winner) {
				case LobbyWinner.Player1:
					xp[1] = 0;
					break;
				case LobbyWinner.Player2:
					xp[0] = 0;
					break;
			}
		}

		if (xp[0]) {
			await this.usersService.update.xp(lobby.player1.uuid, xp[0]);
		}
		if (xp[1]) {
			await this.usersService.update.xp(lobby.player2.uuid, xp[1]);
		}

		return xp;
	}

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

		const xp = await this.updateXP(lobby, winner, left_user_uuid ? true : false);
		lobby.player1_xp = xp[0];
		lobby.player2_xp = xp[1];

		// Awful hack
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
				players_xp: xp,
				winner,
			} as GamesHistoryGetResponse,
		});
	}

	//#endregion
}
