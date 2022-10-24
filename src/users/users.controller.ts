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
	Body,
	Query
} from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { UsersService } from './services/users.service';
import { NotifcationsService } from './services/notifications.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { UsersGetResponse, UsersMeResponse } from './properties/users.get.property';
import {
	UsersFriendshipGetResponse,
	UsersRelationsProperty,
	UsersRelationsResponse
} from './properties/users.relations.get.property';
import { NotificationsGetResponse } from './properties/notifications.get.property';
import { GlobalQueryProperty } from '../app/properties/global.property';

import { parseUnsigned } from '../utils';
import { ApiResponseError, NotifcationType } from './types';
import { UsersPatchProperty } from './properties/users.patch.property';

@UseGuards(AccessAuthGuard)
@Controller('users')
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly notifcationsService: NotifcationsService
	) {}

	/**
	 * Users infos
	 */
	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User infos', type: UsersMeResponse })
	@HttpCode(200)
	@Get('whoami')
	async me(@Request() req: Req) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.whoami(uuid);
	}

	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User details', type: UsersGetResponse })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Get('profile/:uuid')
	@HttpCode(200)
	async get(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.get(uuid, remote_user_uuid);
	}

	/**
	 * Users account
	 */
	@ApiTags('users · account')
	@ApiResponse({ status: 200, description: 'Password changed' })
	@ApiResponse({ status: 400.1, description: "Passwords can't be identical" })
	@ApiResponse({ status: 400.2, description: 'Password missmatch' })
	@Patch()
	@HttpCode(200)
	async changePassword(@Request() req: Req, @Body() body: UsersPatchProperty) {
		const uuid = (req.user as any).uuid;

		await this.usersService.password(uuid, body.current_password, body.new_password);
	}

	//TODO
	// @ApiResponse({ status: 200, description: 'Not yet implemented' })
	// @Delete()
	// @HttpCode(200)
	// async delete() {}

	/**
	 * Relations
	 */
	@ApiTags('users · relations')
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

	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Friendship status', type: UsersRelationsResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseError.FriendYourself })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyFriends })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyPending })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Post('friendship/:uuid')
	@HttpCode(200)
	async updateRelations(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.relations.dispatch({
			action: 'ADD',
			current_user_uuid: uuid,
			user_uuid: remote_user_uuid
		});
	}

	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Friendship status', type: UsersRelationsResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseError.FriendYourself })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyFriends })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyPending })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Delete('friendship/:uuid')
	@HttpCode(200)
	async removeRelations(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		const uuid = (req.user as any).uuid;

		return await this.usersService.relations.dispatch({
			action: 'REMOVE',
			current_user_uuid: uuid,
			user_uuid: remote_user_uuid
		});
	}

	/**
	 * Notifications
	 */
	@ApiTags('users · notifications')
	@ApiQuery({ type: GlobalQueryProperty })
	@ApiResponse({
		status: 200,
		description: 'Unread notifications',
		type: NotificationsGetResponse
	})
	@HttpCode(200)
	@Get('notifications')
	async getNotifications(
		@Request() req: Req,
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any
	) {
		const uuid = (req.user as any).uuid;

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.notifcationsService.get(uuid, page, limit, offset);
	}

	@ApiTags('users · notifications')
	@ApiResponse({
		status: 200,
		description: 'Notification read'
	})
	@HttpCode(200)
	@Delete('notifications/:uuid')
	async readNotifications(@Request() req: Req, @Param('uuid') notification_uuid: string) {
		const uuid = (req.user as any).uuid;

		return await this.notifcationsService.delete({
			current_user_uuid: uuid,
			notification_uuid
		});
	}

	/**
	 * invite
	 */
	@ApiTags('users · invite')
	@ApiResponse({ status: 200, description: 'User notified' })
	@ApiResponse({ status: 400, description: ApiResponseError.BadRequest })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Post('invite/:uuid')
	@HttpCode(200)
	async invite(@Request() req: Req, @Param('uuid') remote_uuid: string) {
		const uuid = (req.user as any).uuid;

		await this.usersService.invite({
			type: NotifcationType.GameInvite,
			notified_user: remote_uuid,
			interact_w_user: uuid
		});
	}
}
