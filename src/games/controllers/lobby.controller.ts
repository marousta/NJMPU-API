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
	Put
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';
import { isUUID } from 'class-validator';

import { GamesLobbyService } from '../services/lobby.service';

import { AccessAuthGuard } from '../../auth/guards/access.guard';

import { GamesLobbyInviteProperty } from '../properties/lobby.add.property';

import { ApiResponseError as ApiResponseErrorGlobal } from '../../types';
import { ApiResponseError as ApiResponseErrorUser } from '../../users/types';
import { JwtData } from '../../auth/types';
import { ApiResponseError } from '../types';
import { GamesLobbyGetResponse } from '../properties/lobby.get.property';
import { GamesLobbyKickProperty } from '../properties/lobby.kick.property';

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
		isArray: true
	})
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Get('all')
	@HttpCode(200)
	async getAll() {
		return await this.lobbyService.lobby.getAll();
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
	async get(@Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		return await this.lobbyService.lobby.get(uuid);
	}
	//#endregion

	/**
	 * Create
	 */
	//#region

	@ApiTags('games · lobby')
	@ApiResponse({
		status: 200,
		description: 'Created lobby',
		type: GamesLobbyGetResponse
	})
	@Post()
	@HttpCode(200)
	async create(@Request() req: Req) {
		const jwt = req.user as JwtData;
		return await this.lobbyService.lobby.createFormat(jwt);
	}

	/**
	 * Join
	 */
	@ApiTags('games · lobby')
	@ApiResponse({ status: 200, description: 'Lobby joined', type: GamesLobbyGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Post('join/:uuid')
	@HttpCode(200)
	async inviteHandler(@Request() req: Req, @Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		return await this.lobbyService.lobby.join(jwt, uuid);
	}

	/**
	 * Invite
	 */
	@ApiTags('games · lobby')
	@ApiBody({ type: GamesLobbyInviteProperty })
	@ApiResponse({
		status: 200,
		description: 'Create lobby if not exist and invite user',
		type: GamesLobbyGetResponse
	})
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseErrorUser.NotFound })
	@Post('invite')
	@HttpCode(200)
	async invite(@Request() req: Req, @Body() body: GamesLobbyInviteProperty) {
		if (!isUUID(body.user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		return await this.lobbyService.lobby.invite(jwt, body.user_uuid);
	}
	//#endregion

	/**
	 * Lobby
	 */
	//#region

	/**
	 * Cancel lobby
	 * Kick user
	 */
	@ApiTags('games · lobby')
	@ApiResponse({ status: 200, description: 'Left' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.LobbyNotFound })
	@Delete(':uuid')
	@HttpCode(200)
	async leave(
		@Request() req: Req,
		@Param('uuid') uuid: string,
		@Body() body: GamesLobbyKickProperty
	) {
		if (!isUUID(uuid, 4) || (body.user_uuid && !isUUID(body.user_uuid, 4))) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		await this.lobbyService.lobby.delete(jwt, uuid);
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
	async accept(@Request() req: Req, @Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const jwt = req.user as JwtData;
		await this.lobbyService.lobby.start(jwt, uuid);
	}
	//#endregion
}
