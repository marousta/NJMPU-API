import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';

import { WsService } from '../../websockets/ws.service';

import { UserStatus } from '../../users/types';
import { ApiResponseError } from '../types';
import { JwtData } from '../../auth/types';
import { GameAction, WsNamespace, WebSocketUser } from '../../websockets/types';
import { GamesLobbyService } from './lobby.service';

@Injectable()
export class GamesMatchmakingService {
	private readonly logger = new Logger(GamesMatchmakingService.name);
	private readonly waiting_queue: { [uuid: string]: WebSocketUser } = {};
	private waiting_loop: NodeJS.Timer = null;
	constructor(
		@Inject(forwardRef(() => WsService))
		private readonly wsService: WsService,
		private readonly lobbyService: GamesLobbyService
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

	public readonly loop = {
		start: () => {
			if (this.waiting_loop) {
				return;
			}
			this.waiting_loop = setInterval(this.queue.wait, 100);
		},
		stop: () => {
			if (!this.waiting_loop) {
				return;
			}
			clearInterval(this.waiting_loop);
			this.waiting_loop = null;
		}
	};

	public readonly queue = {
		add: (jwt: JwtData) => {
			const user = jwt.infos;
			let current_client: WebSocketUser = null;

			const state = this.wsService.findAllConnected(user.uuid);
			switch (state.status) {
				case UserStatus.Offline:
					throw new BadRequestException(ApiResponseError.NotConnected);
				case UserStatus.InGame:
					throw new BadRequestException(ApiResponseError.AlreadyInGame);
				case UserStatus.Online:
					if (
						!state.clients.map((client) => {
							if (jwt.token.tuuid === jwt.token.tuuid) {
								current_client = client;
								return true;
							}
							return false;
						})
					) {
						throw new BadRequestException(ApiResponseError.NotOnline);
					}
			}

			if (this.waiting_queue[user.uuid]) {
				throw new BadRequestException(ApiResponseError.AlreadyInQueue);
			}

			this.waiting_queue[user.uuid] = current_client;

			this.wsService.dispatch.client([current_client], {
				namespace: WsNamespace.Game,
				action: GameAction.Wait
			});

			this.loop.start();
		},
		remove: (jwt: JwtData) => {
			const user = jwt.infos;
			if (
				!this.waiting_queue[user.uuid] ||
				this.waiting_queue[user.uuid].jwt.token.tuuid !== jwt.token.tuuid
			) {
				return false;
			}
			delete this.waiting_queue[user.uuid];

			this.logger.debug('Removed user ' + user.uuid + ' from queue');
			return true;
		},
		wait: () => {
			const found = Object.values(this.waiting_queue);
			if (found.length === 1) {
				this.logger.debug('Player in queue');
				return;
			}
			if (found.length === 0) {
				this.logger.debug('Queue empty');
				return this.loop.stop();
			}

			const player1 = found[0];
			const player2 = found[1];

			this.logger.debug(
				'Match found for ' + player1.jwt.infos.uuid + ' and ' + player2.jwt.infos.uuid
			);

			this.lobbyService.lobby.createMatch(player1, player2);
			this.queue.remove(player1.jwt);
			this.queue.remove(player2.jwt);
		}
	};

	//#endregion
}
