import {
	Controller,
	HttpCode,
	Post,
	Request,
	UseGuards,
	BadRequestException,
	Delete,
	Body,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';
import { isUUID } from 'class-validator';

import { GamesMatchmakingService } from '../services/matchmaking.service';

import { AccessAuthGuard } from '../../auth/guards/access.guard';

import { GamesJoinProperty } from '../properties/lobby.add.property';

import { JwtData } from '../../auth/types';
import { ApiResponseError } from '../types';
import { ApiResponseError as ApiResponseErrorGlobal } from '../../types';

@UseGuards(AccessAuthGuard)
@Controller('games/matchmaking')
export class GamesMatchmakingController {
	constructor(private readonly matchmakingService: GamesMatchmakingService) {}

	/**
	 * Matchmaking
	 */

	/**
	 * Join a queue
	 */
	@ApiTags('games · matchmaking')
	@ApiBody({ type: GamesJoinProperty })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.NotConnected })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyInGame })
	@ApiResponse({ status: 400.4, description: ApiResponseError.NotOnline })
	@ApiResponse({ status: 400.5, description: ApiResponseError.AlreadyInQueue })
	@Post()
	@HttpCode(200)
	matchmaking(@Request() req: Req, @Body() body: GamesJoinProperty) {
		if (!isUUID(body.websocket_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}
		const jwt = req.user as JwtData;

		this.matchmakingService.queue.add(jwt, body.websocket_uuid);
	}

	/**
	 * Remove from queue
	 */
	@ApiTags('games · matchmaking')
	@ApiResponse({ status: 400, description: ApiResponseError.NotInQueue })
	@Delete()
	@HttpCode(200)
	undo(@Request() req: Req) {
		const jwt = req.user as JwtData;

		const removed = this.matchmakingService.queue.remove(jwt);
		if (!removed) {
			throw new BadRequestException(ApiResponseError.NotInQueue);
		}
	}
	//#endregion
}
