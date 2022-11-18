import { Logger, Request, InternalServerErrorException } from '@nestjs/common';
import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	ConnectedSocket
} from '@nestjs/websockets';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { Server } from 'ws';
import { Request as Req } from 'express';
import * as getHeaders from 'get-headers';
import * as cookie from 'cookie';
import { getClientIp } from 'request-ip';
import { randomUUID } from 'crypto';

import { WsService } from './ws.service';
import { TokensService } from '../auth/tokens/tokens.service';
import { UsersService } from '../users/services/users.service';

import { UserAction, WebSocketUser, WsNamespace } from './types';
import { Jwt } from '../auth/types';

@WebSocketGateway({
	path: '/api/streaming',
	cors: true
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
	private readonly logger = new Logger(WsGateway.name);
	constructor(
		private readonly jwtService: JwtService,
		private readonly tokensService: TokensService,
		private readonly usersService: UsersService,
		private readonly wsService: WsService
	) {}

	@WebSocketServer()
	readonly server: Server;

	/**
	 * Utils
	 */
	//#region  Utils
	private getCookies(req: Req) {
		const headers = getHeaders.array(req.rawHeaders);
		const cookies = headers['Cookie'] as string;
		return cookies ? cookie.parse(cookies) : {};
	}

	async validate(cookies: any, ua: string, ip: string): Promise<Jwt> {
		const config = {
			algorithms: ['RS256'],
			ignoreExpiration: false
		};

		const valid_jwt_token = await Promise.all([
			this.jwtService
				.verifyAsync(cookies['access_token'], config as JwtVerifyOptions)
				.catch((e) => null),
			this.jwtService
				.verifyAsync(cookies['refresh_token'], config as JwtVerifyOptions)
				.catch((e) => null)
		]);
		if (!valid_jwt_token[0] || !valid_jwt_token[1]) {
			return null;
		}

		const valid_token = await Promise.all([
			this.tokensService
				.validate(
					valid_jwt_token[0].tuuid,
					{ access_token: cookies['access_token'] },
					ua,
					ip
				)
				.then((r) => true)
				.catch((e) => false),
			this.tokensService
				.validate(
					valid_jwt_token[1].tuuid,
					{ refresh_token: cookies['refresh_token'] },
					ua,
					ip
				)
				.then((r) => true)
				.catch((e) => false)
		]);

		if (!valid_token[0] || !valid_token[1]) {
			return null;
		}

		return valid_jwt_token as any;
	}
	//#endregion

	// @SubscribeMessage(WsNamespace.Game)
	// onGame(@ConnectedSocket() client: WebSocket, @Request() req: Req, @Body() data: any) {
	// 	console.log('onMessage ' + data);
	// }

	async handleConnection(@ConnectedSocket() client: WebSocketUser, @Request() req: Req) {
		// Validation
		const headers = getHeaders.array(req.rawHeaders);
		const ip = getClientIp(req);
		const cookies = this.getCookies(req);
		const jwt = await this.validate(cookies, headers['User-Agent'] as string, ip);
		if (jwt === null) {
			client.send(
				JSON.stringify({
					namespace: WsNamespace.User,
					action: UserAction.Refresh
				})
			);
			client.close();
			return;
		}

		// Post validation
		const uuid = jwt[0].uuuid;
		if (!uuid) {
			this.logger.error('Cannot get user uuid, this should not happen');
			throw new InternalServerErrorException();
		}
		const user = await this.usersService.findWithRelationsOrNull(
			{ uuid },
			'Cannot get user, this should not happen'
		);
		if (!user) {
			throw new InternalServerErrorException();
		}
		client.uuid = randomUUID();
		client.jwt = {
			infos: user,
			token: jwt[1]
		};
		client.lobby_uuid = null;

		await this.wsService.connected(client);
	}

	handleDisconnect(client: WebSocketUser) {
		const user = client.jwt?.infos;
		if (!user) {
			this.logger.verbose('Disconnected unauthenticated client');
			return;
		}
		this.wsService.disconnected(client);
	}

	afterInit(server: Server) {
		this.logger.log('Websocket is live');
	}
}
