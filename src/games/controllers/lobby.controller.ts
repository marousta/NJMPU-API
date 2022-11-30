import {
	Controller,
	HttpCode,
	Param,
	Post,
	Request,
	UseGuards,
	BadRequestException,
	Get,
	Body,
	Delete,
	Put,
	Patch,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';
import { isUUID } from 'class-validator';
import validateColor from 'validate-color';

import { GamesLobbyService } from '../services/lobby.service';

import { AccessAuthGuard } from '../../auth/guards/access.guard';

import { GamesJoinProperty, GamesLobbyInviteProperty } from '../properties/lobby.add.property';
import { GamesLobbyGetResponse } from '../properties/lobby.get.property';
import { GamesLobbyKickProperty } from '../properties/lobby.kick.property';

import { ApiResponseError as ApiResponseErrorGlobal } from '../../types';
import { ApiResponseError as ApiResponseErrorUser } from '../../users/types';
import { JwtData } from '../../auth/types';
import { ApiResponseError } from '../types';
import { GamesLobbyColorProperty } from '../properties/lobby.color.property';

@UseGuards(AccessAuthGuard)
@Controller('games/lobby')
export class GamesLobbyController {
	constructor(private readonly lobbyService: GamesLobbyService) {}

	/**
	 * Lobby infos
	 */
	//#region

	/**
	 * Get all
	 */
	@ApiTags('games · lobby')
	@ApiResponse({
		status: 200,
		description: 'All active lobbies infos',
		type: GamesLobbyGetResponse,
		isArray: true,
	})
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Get('all')
	@HttpCode(200)
	getAll() {
		return this.lobbyService.lobby.getAllFormat();
	}

	/**
	 * Get one
	 */
	@ApiTags('games · lobby')
	@ApiResponse({ status: 200, description: 'Lobby infos', type: GamesLobbyGetResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseErrorGlobal.BadRequest })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Get(':uuid')
	@HttpCode(200)
	get(@Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		return this.lobbyService.lobby.getFormat(uuid);
	}
	//#endregion

	/**
	 * Create
	 */
	//#region

	@ApiTags('games · lobby')
	@ApiBody({ type: GamesJoinProperty })
	@ApiResponse({ status: 200, description: 'Created lobby', type: GamesLobbyGetResponse })
	@Post()
	@HttpCode(200)
	create(@Request() req: Req, @Body() body: GamesJoinProperty) {
		if (!isUUID(body.websocket_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		return this.lobbyService.lobby.createFormat(jwt, body.websocket_uuid);
	}

	/**
	 * Join
	 */
	@ApiTags('games · lobby')
	@ApiBody({ type: GamesJoinProperty })
	@ApiResponse({ status: 200, description: 'Lobby joined', type: GamesLobbyGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Post('join/:uuid')
	@HttpCode(200)
	async joinLobby(
		@Request() req: Req,
		@Param('uuid') uuid: string,
		@Body() body: GamesJoinProperty,
	) {
		if (!isUUID(uuid, 4) || !isUUID(body.websocket_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		return await this.lobbyService.lobby.join(jwt, uuid, body.websocket_uuid);
	}

	@ApiTags('games · lobby')
	@ApiResponse({ status: 200, description: 'Decline invite' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.InvalidInvitation })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Delete('join/:uuid')
	@HttpCode(200)
	async inviteDecline(@Request() req: Req, @Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		await this.lobbyService.lobby.decline(jwt, uuid);
	}

	/**
	 * Invite
	 */
	@ApiTags('games · lobby')
	@ApiBody({ type: GamesLobbyInviteProperty })
	@ApiResponse({
		status: 200,
		description: 'Create lobby if not exist and invite user',
		type: GamesLobbyGetResponse,
	})
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseErrorUser.NotFound })
	@Post('invite')
	@HttpCode(200)
	async invite(@Request() req: Req, @Body() body: GamesLobbyInviteProperty) {
		if (!isUUID(body.user_uuid, 4) || !isUUID(body.websocket_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		return await this.lobbyService.lobby.invite(jwt, body.websocket_uuid, body.user_uuid);
	}
	//#endregion

	/**
	 * Lobby
	 */
	//#region

	/**
	 * Change player color
	 */
	@ApiTags('games · lobby')
	@ApiBody({ type: GamesLobbyColorProperty })
	@ApiResponse({ status: 200, description: 'Color set' })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Patch(':uuid')
	@HttpCode(200)
	changeColor(
		@Request() req: Req,
		@Param('uuid') uuid: string,
		@Body() body: GamesLobbyColorProperty,
	) {
		if (!isUUID(uuid, 4) || !validateColor(body.color)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		this.lobbyService.lobby.color(jwt, uuid, body.color);
	}

	/**
	 * Cancel lobby
	 * Kick user
	 */
	@ApiTags('games · lobby')
	@ApiBody({
		type: GamesLobbyKickProperty,
		examples: {
			['Leave']: {
				value: {} as GamesLobbyKickProperty,
			},
			['Kick']: {
				value: {
					user_uuid: 'string',
				} as GamesLobbyKickProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'Left' })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Delete(':uuid')
	@HttpCode(200)
	async leave(
		@Request() req: Req,
		@Param('uuid') uuid: string,
		@Body() body: GamesLobbyKickProperty,
	) {
		if (!isUUID(uuid, 4) || (body.user_uuid && !isUUID(body.user_uuid, 4))) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;

		if (body.user_uuid) {
			return await this.lobbyService.lobby.kick(jwt, uuid, body.user_uuid);
		}

		await this.lobbyService.lobby.leave(jwt, uuid);
	}

	/**
	 * Start game when all players are ready
	 */
	@ApiTags('games · lobby')
	@ApiResponse({ status: 200, description: 'User ready' })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Put(':uuid')
	@HttpCode(200)
	ready(@Request() req: Req, @Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		this.lobbyService.lobby.start(jwt, uuid);
	}
	//#endregion
}
