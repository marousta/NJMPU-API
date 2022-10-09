import {
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	UseGuards,
	Request,
	Body
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { UsersService } from './users.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { UsersGetResponse, UsersMeResponse } from './properties/users.get.property';
import {
	UsersFriendshipGetResponse,
	UsersRelationsProperty,
	UsersRelationsResponse
} from './properties/users.relations.get.property';

import { ApiResponseError } from './types';

@UseGuards(AccessAuthGuard)
@ApiTags('users')
@Controller('users')
export class UsersController {
	constructor(public readonly usersService: UsersService) {}

	@ApiResponse({ status: 200, description: 'User infos', type: UsersMeResponse })
	@HttpCode(200)
	@Get()
	async me(@Request() req: Req) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.me(uuid);
	}

	@ApiResponse({
		status: 200,
		description: 'Friendship infos',
		type: [UsersFriendshipGetResponse]
	})
	@HttpCode(200)
	@Get('relations')
	async getRelations(@Request() req: Req) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.relations.get(uuid);
	}

	@ApiResponse({ status: 200, description: 'User details', type: UsersGetResponse })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Get(':uuid')
	@HttpCode(200)
	async get(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.get(uuid, remote_user_uuid);
	}

	@ApiBody({ type: UsersRelationsProperty })
	@ApiResponse({ status: 200, description: 'Friendship status', type: UsersRelationsResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseError.FriendYourself })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyFriends })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyPending })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Post()
	@HttpCode(200)
	async updateRelations(@Request() req: Req, @Body() body: UsersRelationsProperty) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.relations.dispatch({
			action: body.action,
			current_user_uuid: uuid,
			user_uuid: body.user_uuid
		});
	}

	//TODO
	// @ApiResponse({ status: 200, description: 'Not yet implemented' })
	// @Patch()
	// @HttpCode(200)
	// async update() {}

	//TODO
	// @ApiResponse({ status: 200, description: 'Not yet implemented' })
	// @Delete()
	// @HttpCode(200)
	// async delete() {}
}
