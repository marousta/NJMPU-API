import {
	Controller,
	Delete,
	Get,
	HttpCode,
	BadRequestException,
	Request,
	UseGuards,
	Query,
	Param
} from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { SessionsService } from '../services/sessions.service';

import { AccessAuthGuard } from '../guards/access.guard';

import { SessionsGetResponse } from '../properties/sessions.property';
import { GlobalQueryProperty } from '../../app/properties/global.property';

import { parseUnsigned } from '../../utils';
import { ApiResponseError, JwtData } from '../types';

@UseGuards(AccessAuthGuard)
@ApiTags('users · sessions')
@Controller('users/sessions')
export class SessionsController {
	constructor(private readonly sessionsService: SessionsService) {}

	@ApiResponse({
		status: 200,
		description: 'Sessions of currently connected user',
		type: SessionsGetResponse
	})
	@ApiQuery({ type: GlobalQueryProperty })
	@Get()
	@HttpCode(200)
	async get(
		@Request() req: Req,
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any
	) {
		const jwt = req.user as JwtData;
		const tuuid = jwt.token.tuuid;
		const uuuid = jwt.infos.uuid;

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.sessionsService.get(tuuid, uuuid, page, limit, offset);
	}

	@ApiResponse({ status: 200, description: 'Session destroyed' })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingSession })
	@ApiResponse({ status: 404, description: ApiResponseError.InvalidSession })
	@Delete(':id')
	@HttpCode(200)
	async destroy(@Request() req: Req, @Param('id') tuuid: string) {
		const uuuid = (req.user as JwtData).infos.uuid;
		if (!tuuid) {
			throw new BadRequestException(ApiResponseError.MissingSession);
		}
		await this.sessionsService.destroy(tuuid, uuuid);
	}
}
