import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';

import { GamesLobbyService } from './lobby.service';
import { UsersService } from '../../users/services/users.service';
import { WsService } from '../../websockets/ws.service';

import { UserStatus } from '../../users/types';
import { ApiResponseError } from '../types';
import { JwtData } from '../../auth/types';
import { GameAction, WsNamespace, WebSocketUser } from '../../websockets/types';

@Injectable()
export class GamesMatchmakingService {
	private readonly logger = new Logger(GamesMatchmakingService.name);
	private readonly waiting_queue: { [uuid: string]: WebSocketUser } = {};
	private waiting_loop: NodeJS.Timer = null;
	constructor(
		private readonly lobbyService: GamesLobbyService,
		@Inject(forwardRef(() => UsersService))
		private readonly usersService: UsersService,
		@Inject(forwardRef(() => WsService))
		private readonly wsService: WsService,
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
		},
	};

	public readonly queue = {
		add: (jwt: JwtData, websocket_uuid: string) => {
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
							if (client.uuid === websocket_uuid) {
								current_client = client;
								return true;
							}
							return false;
						})
					) {
						throw new BadRequestException(ApiResponseError.NotOnline);
					}
			}

			// console.log('QUEUE ADD CLIENT: ', current_client?.uuid ?? null);

			if (this.waiting_queue[user.uuid]) {
				throw new BadRequestException(ApiResponseError.AlreadyInQueue);
			}

			this.waiting_queue[user.uuid] = current_client;

			this.wsService.dispatch.client([current_client], {
				namespace: WsNamespace.Game,
				action: GameAction.Wait,
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
				return;
			}
			if (found.length === 0) {
				this.logger.debug('Queue empty');
				return this.loop.stop();
			}

			for (const client1 of found) {
				for (const client2 of found) {
					if (
						client1.jwt.infos.uuid === client2.jwt.infos.uuid ||
						this.usersService.isBlocked(client1.jwt.infos, client2.jwt.infos)
					) {
						continue;
					}

					this.logger.debug(
						'Match found for ' +
							client1.jwt.infos.uuid +
							' and ' +
							client2.jwt.infos.uuid,
					);

					// console.log('##################');
					// console.log('QUEUE WAIT CLIENT1: ', client1?.uuid ?? null);
					// console.log('QUEUE WAIT CLIENT2: ', client2?.uuid ?? null);

					this.lobbyService.lobby.createMatch(client1, client2);
					this.queue.remove(client1.jwt);
					this.queue.remove(client2.jwt);
					return;
				}
			}
		},
	};

	//#endregion
}
