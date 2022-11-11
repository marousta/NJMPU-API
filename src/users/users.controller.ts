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
	Query,
	BadRequestException
} from '@nestjs/common';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';
import { isUUID } from 'class-validator';

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

import { parseUnsigned, isEmpty } from '../utils';

import { ApiResponseError as ApiResponseErrorGlobal } from '../types';
import { ApiResponseError, RelationType, RelationDispatch } from './types';
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
	//#region

	/**
	 * Whoami
	 */
	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User infos', type: UsersMeResponse })
	@HttpCode(200)
	@Get('whoami')
	async me(@Request() req: Req) {
		const user = (req.user as JwtData).infos;

		return await this.usersService.whoami(user);
	}

	/**
	 * Get one by uuid
	 */
	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User details', type: UsersGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Get('profile/:uuid')
	@HttpCode(200)
	async getOneByUUID(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		if (!isUUID(remote_user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		return await this.usersService.get.ByUUID(user, remote_user_uuid);
	}

	/**
	 * Get one by name and identifier
	 */
	@ApiTags('users · infos')
	@ApiResponse({ status: 200, description: 'User details', type: UsersGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Get('profile/:username/:identifier')
	@HttpCode(200)
	async getByIdentifier(
		@Request() req: Req,
		@Param('username') remote_username: string,
		@Param('identifier') remote_identifier: number
	) {
		if (isEmpty(remote_username)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}
		remote_identifier = parseUnsigned({ identifier: remote_identifier });

		const user = (req.user as JwtData).infos;

		return await this.usersService.get.ByIdentifier(user, remote_username, remote_identifier);
	}
	//#endregion

	/**
	 * Users account
	 */
	//#region

	/**
	 * Change password
	 */
	@ApiTags('users · account')
	@ApiResponse({ status: 200, description: 'Password changed' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.ConfirmMismatch })
	@ApiResponse({ status: 400.3, description: ApiResponseError.PasswordsIdentical })
	@ApiResponse({ status: 400.4, description: ApiResponseError.PasswordMismatch })
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
	//#endregion

	/**
	 * Relations
	 */
	//#region

	/**
	 * Get relation
	 */
	@ApiTags('users · relations')
	@ApiResponse({
		status: 200,
		description: 'relations status',
		type: UsersRelationsResponse
	})
	@HttpCode(200)
	@Get('relations')
	async getRelations(@Request() req: Req) {
		const user = (req.user as JwtData).infos;

		return await this.usersService.relations.get(user);
	}

	/**
	 * Add friend
	 */
	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Friendship status', type: UsersFriendshipResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.FriendYourself })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyFriends })
	@ApiResponse({ status: 400.4, description: ApiResponseError.AlreadyPending })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Post('friendship/:uuid')
	@HttpCode(200)
	async updateFriendship(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		if (!isUUID(remote_user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		return await this.usersService.relations.dispatch(
			RelationType.Friends,
			RelationDispatch.Add,
			user,
			remote_user_uuid
		);
	}

	/**
	 * Remove friend
	 */
	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Friendship removed' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.FriendYourself })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyFriends })
	@ApiResponse({ status: 400.4, description: ApiResponseError.AlreadyPending })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Delete('friendship/:uuid')
	@HttpCode(200)
	async removeFriendship(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		if (!isUUID(remote_user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.usersService.relations.dispatch(
			RelationType.Friends,
			RelationDispatch.Remove,
			user,
			remote_user_uuid
		);
	}

	/**
	 * Block
	 */
	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Blocked user' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.BlockYourself })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyBlocked })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Post('blocklist/:uuid')
	@HttpCode(200)
	async updateBlocklist(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		if (!isUUID(remote_user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.usersService.relations.dispatch(
			RelationType.Blocklist,
			RelationDispatch.Add,
			user,
			remote_user_uuid
		);
	}

	/**
	 * Unblock
	 */
	@ApiTags('users · relations')
	@ApiResponse({ status: 200, description: 'Unblocked user' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.BlockYourself })
	@ApiResponse({ status: 400.3, description: ApiResponseError.NotBlocked })
	@ApiResponse({ status: 404, description: ApiResponseError.NotFound })
	@Delete('blocklist/:uuid')
	@HttpCode(200)
	async removeBlocklist(@Request() req: Req, @Param('uuid') remote_user_uuid: string) {
		if (!isUUID(remote_user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.usersService.relations.dispatch(
			RelationType.Blocklist,
			RelationDispatch.Remove,
			user,
			remote_user_uuid
		);
	}
	//#endregion

	/**
	 * Notifications
	 */
	//#region

	/**
	 * Get
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

	/**
	 * Read
	 */
	@ApiTags('users · notifications')
	@ApiResponse({
		status: 200,
		description: 'Notification read'
	})
	@HttpCode(200)
	@Delete('notifications/:uuid')
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	async readNotifications(@Request() req: Req, @Param('uuid') notification_uuid: string) {
		if (!isUUID(notification_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		return await this.notifcationsService.read.ByUUID(user, notification_uuid);
	}
	//#endregion
}
