import { Body, Logger, Request, InternalServerErrorException } from '@nestjs/common';
import {
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	ConnectedSocket
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Request as Req } from 'express';
import * as getHeaders from 'get-headers';
import * as cookie from 'cookie';

import { WsService } from './ws.service';

import { UserAction, WsNamespace } from './types';
import { readFileSync } from 'fs';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokensService } from '../auth/tokens/tokens.service';
import { getClientIp } from 'request-ip';

@WebSocketGateway({
	path: '/api/streaming',
	cors: true
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
	private readonly logger = new Logger(WsGateway.name);
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly tokensService: TokensService,
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

	private parseCookies(cookies: Record<string, string>) {
		const token_str = {
			access_token: cookies['access_token'],
			refresh_token: cookies['refresh_token']
		};
		if (!token_str.access_token || !token_str.refresh_token) {
			return null;
		}
		let ret = {};
		for (const token in token_str) {
			const arr = token_str[token].split('.');
			const buff = Buffer.from(arr[1], 'base64').toString();
			ret[token] = JSON.parse(buff);
		}
		return ret;
	}

	private getUUID(parsed_cookies: any): string | null {
		if (!parsed_cookies) {
			return null;
		}
		return parsed_cookies.access_token.uuid;
	}

	async validate(cookies: any, ua: string, ip: string): Promise<boolean> {
		const config = {
			algorithms: ['RS256'],
			secret: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
				encoding: 'ascii'
			})
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
			return false;
		}

		const valid_token = await Promise.all([
			this.tokensService
				.validate(valid_jwt_token[0].id, { access_token: cookies['access_token'] }, ua, ip)
				.catch((e) => false)
				.then((r) => true),
			this.tokensService
				.validate(
					valid_jwt_token[1].id,
					{ refresh_token: cookies['refresh_token'] },
					ua,
					ip
				)
				.catch((e) => false)
				.then((r) => true)
		]);

		return valid_token[0] && valid_token[1];
	}
	//#endregion

	// @SubscribeMessage(WsNamespace.Game)
	// onGame(@ConnectedSocket() client: WebSocket, @Request() req: Req, @Body() data: any) {
	// 	console.log('onMessage ' + data);
	// }

	async handleConnection(@ConnectedSocket() client: WebSocket, @Request() req: Req) {
		// Validation
		const headers = getHeaders.array(req.rawHeaders);
		const ip = getClientIp(req);
		const cookies = this.getCookies(req);
		const validate = await this.validate(cookies, headers['User-Agent'] as string, ip);
		if (!validate) {
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
		const parsed_cookies: any = this.parseCookies(cookies);
		const uuid = this.getUUID(parsed_cookies);
		if (!uuid) {
			this.logger.error('Cannot get user uuid, this should not happen');
			throw new InternalServerErrorException();
		}
		client['user_uuid'] = uuid;
		client['refresh_token_exp'] = parsed_cookies.refresh_token.exp;

		await this.wsService.connected(uuid);
	}

	handleDisconnect(client: WebSocket) {
		const uuid = client['user_uuid'];
		this.wsService.disconnected(uuid);
	}

	afterInit(server: Server) {
		this.wsService.ws = server;
		this.logger.log('Websocket is live');
	}
}
