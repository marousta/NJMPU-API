import {
	Controller,
	HttpCode,
	Post,
	Request,
	UseGuards,
	BadRequestException,
	Delete
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { GamesMatchmakingService } from '../services/matchmaking.service';

import { AccessAuthGuard } from '../../auth/guards/access.guard';

import { JwtData } from '../../auth/types';
import { ApiResponseError } from '../types';

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
	@ApiResponse({ status: 400.1, description: ApiResponseError.NotConnected })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyInGame })
	@ApiResponse({ status: 400.3, description: ApiResponseError.NotOnline })
	@ApiResponse({ status: 400.4, description: ApiResponseError.AlreadyInQueue })
	@Post()
	@HttpCode(200)
	matchmaking(@Request() req: Req) {
		const jwt = req.user as JwtData;
		this.matchmakingService.queue.add(jwt);
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
