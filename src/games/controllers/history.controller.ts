import {
	Controller,
	HttpCode,
	Param,
	UseGuards,
	BadRequestException,
	Get,
	Request,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Request as Req } from 'express';

import { GamesHistoryService } from '../services/history.service';

import { AccessAuthGuard } from '../../auth/guards/access.guard';

import { GamesHistoryGetResponse } from '../properties/history.get.property';

import { ApiResponseError as ApiResponseErrorGlobal } from '../../types';
import { ApiResponseError as ApiResponseErrorUser } from '../../users/types';
import { JwtData } from '../../auth/types';

@UseGuards(AccessAuthGuard)
@Controller('games/history')
export class GamesHistoryController {
	constructor(private readonly historyService: GamesHistoryService) {}

	/**
	 * Games history
	 */
	//#region

	/**
	 * Get all by user
	 */
	@ApiTags('games · history')
	@ApiResponse({
		status: 200,
		description: 'Games history of given user',
		type: GamesHistoryGetResponse,
		isArray: true,
	})
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseErrorUser.NotFound })
	@Get(':uuid')
	@HttpCode(200)
	async get(@Request() req: Req, @Param('uuid') uuid: string) {
		if (!isUUID(uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user_uuid = (req.user as JwtData).infos.uuid;

		return await this.historyService.get(uuid, user_uuid === uuid);
	}
	//#endregion
}
