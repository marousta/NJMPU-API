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
import { AuthGuard } from '@nestjs/passport';

import { SessionsService } from './sessions.service';

import { SessionsGetResponse } from './sessions.property';
import { GlobalQueryProperty } from '../../app/properties/global.property';

import { parseUnsigned } from '../../utils';

@UseGuards(AuthGuard('access'))
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
		const tid = (req.user as any).id;
		const uuid = (req.user as any).uuid;
		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });
		return await this.sessionsService.get(tid, uuid, page, limit, offset);
	}

	// @ApiQuery({ type: SessionsDeleteProperty })
	@ApiResponse({ status: 400, description: 'Missing session id' })
	@ApiResponse({ status: 404, description: 'Invalid session id' })
	@Delete(':id')
	@HttpCode(200)
	async destroy(@Request() req: Req, @Param('id') id: number) {
		const uuid = (req.user as any).uuid;
		if (!id) {
			throw new BadRequestException('Missing session id');
		}
		await this.sessionsService.destroy(uuid, id);
	}
}
