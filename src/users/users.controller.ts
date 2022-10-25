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
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { UsersService } from './services/users.service';
import { NotifcationsService } from './services/notifications.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { UsersGetResponse, UsersMeResponse } from './properties/users.get.property';
import {
	UsersFriendshipResponse,
	UsersRelationsResponse
} from './properties/users.relations.get.property';
import { NotificationsGetResponse } from './properties/notifications.get.property';
import { GlobalQueryProperty } from '../app/properties/global.property';
import { UsersPatchProperty } from './properties/users.patch.property';

import { parseUnsigned } from '../utils';
import { ApiResponseError } from './types';
import { JwtData } from '../auth/types';

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
		const user = (req.user as JwtData).infos;

		return await this.usersService.whoami(user);
	}

	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User details', type: UsersGetResponse })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Get('profile/:uuid')
	@HttpCode(200)
	async get(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		const user = (req.user as JwtData).infos;

		return await this.usersService.get(user, remote_user_uuid);
	}

	/**
	 * Users account
	 */
	@ApiTags('users · account')
	@ApiResponse({ status: 200, description: 'Password changed' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.Confirmmismatch })
	@ApiResponse({ status: 400.2, description: ApiResponseError.PasswordsIdentical })
	@ApiResponse({ status: 400.3, description: ApiResponseError.Passwordmismatch })
	@Patch()
	@HttpCode(200)
	async changePassword(@Request() req: Req, @Body() body: UsersPatchProperty) {
		const user = (req.user as JwtData).infos;

		await this.usersService.password(
			user,
			body.current_password,
			body.new_password,
			body.confirm
		);
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
		type: [UsersFriendshipResponse]
	})
	@HttpCode(200)
	@Get('relations')
	async getRelations(@Request() req: Req) {
		const user = (req.user as JwtData).infos;

		return await this.usersService.relations.get(user);
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
		const user = (req.user as JwtData).infos;

		return await this.usersService.relations.dispatch('ADD', user, remote_user_uuid);
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
		const user = (req.user as JwtData).infos;

		return await this.usersService.relations.dispatch('REMOVE', user, remote_user_uuid);
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
		const user = (req.user as JwtData).infos;

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.notifcationsService.get(user, page, limit, offset);
	}

	@ApiTags('users · notifications')
	@ApiResponse({
		status: 200,
		description: 'Notification read'
	})
	@HttpCode(200)
	@Delete('notifications/:uuid')
	async readNotifications(@Request() req: Req, @Param('uuid') notification_uuid: string) {
		const user = (req.user as JwtData).infos;

		return await this.notifcationsService.delete(user, notification_uuid);
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
		const user = (req.user as JwtData).infos;

		await this.usersService.invite(user, remote_uuid);
	}
}
