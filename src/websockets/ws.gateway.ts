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

import { WsNamespace } from './types';

@WebSocketGateway({
	path: '/api/streaming',
	cors: true,
	origins: ['http://localhost:5137']
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
	private readonly logger = new Logger(WsGateway.name);
	constructor(private readonly wsService: WsService) {}

	@WebSocketServer()
	readonly server: Server;

	/**
	 * Utils
	 */
	//#region  Utils
	private getCookies(req: Req) {
		const headers = getHeaders.array(req.rawHeaders);
		return cookie.parse(headers['Cookie'] as string);
	}

	private getUUID(req: Req): string | null {
		const cookies = this.getCookies(req);
		const access_token = cookies['access_token'];
		if (!access_token) {
			return null;
		}
		const arr = access_token.split('.');
		const buff = Buffer.from(arr[1], 'base64').toString();
		const user = JSON.parse(buff);
		return (user as any).uuid;
	}
	//#endregion

	// @SubscribeMessage(WsNamespace.Game)
	// onGame(@ConnectedSocket() client: WebSocket, @Request() req: Req, @Body() data: any) {
	// 	console.log('onMessage ' + data);
	// }

	async handleConnection(@ConnectedSocket() client: WebSocket, @Request() req: Req) {
		const uuid = this.getUUID(req);
		if (!uuid) {
			this.logger.error('Cannot get user uuid, this should not happen');
			throw new InternalServerErrorException();
		}
		client['user_uuid'] = uuid;
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
