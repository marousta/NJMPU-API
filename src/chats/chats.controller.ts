import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Query,
	Request,
	Response,
	UseGuards,
	BadRequestException,
	Put,
	Patch,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req, Response as Res } from 'express';
import { isUUID } from 'class-validator';

import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { GlobalQueryProperty } from '../app/properties/global.property';
import { ChannelsCreateProperty } from './properties/channels.create.property';
import {
	ChannelsDataGetResponse,
	ChannelGetResponse,
	ChannelPrivateGetResponse,
	ChannelPrivateProperty,
} from './properties/channels.get.property';
import { MessageStoreProperty } from './properties/messages.store.property';
import { MessagesGetProperty, MessagesGetResponse } from './properties/messages.get.propoerty';
import { MessageDeleteProperty } from './properties/messages.delete.property';
import { ChannelSettingProperty } from './properties/channels.update.property';
import { ChannelLeaveProperty, LeaveAction } from './properties/channels.delete.property';
import { ChannelModerationProperty } from './properties/channels.update.property';
import { BlacklistGetResponse } from './properties/channels.blacklist.get.property';

import { isEmpty, parseUnsigned } from '../utils';

import { ChannelType, ApiResponseError } from './types';
import { ChatAction } from '../websockets/types';
import { JwtData } from '../auth/types';
import { ApiResponseError as ApiResponseErrorGlobal } from '../types';

@UseGuards(AccessAuthGuard)
@Controller('chats/channels')
export class ChatsController {
	constructor(
		private readonly channelsService: ChannelsService,
		private readonly messagesService: MessagesService,
	) {}

	/**
	 * Channels
	 */
	//#region

	/**
	 * Get all
	 */
	@ApiTags('chats · channels')
	@ApiQuery({ type: GlobalQueryProperty })
	@ApiResponse({ status: 200, description: 'List of channels', type: ChannelsDataGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseError.InvalidQuery })
	@HttpCode(200)
	@Get()
	async getAll(
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any,
	) {
		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.channelsService.getAll(page, limit, offset);
	}

	/**
	 * Get all in
	 */
	@ApiTags('chats · channels')
	@ApiQuery({ type: GlobalQueryProperty })
	@ApiResponse({
		status: 200,
		description: 'List of joined channels',
		type: ChannelsDataGetResponse,
	})
	@ApiResponse({ status: 400, description: ApiResponseError.InvalidQuery })
	@HttpCode(200)
	@Get('in')
	async getAllin(
		@Request() req: Req,
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any,
	) {
		const uuid = (req.user as JwtData).infos.uuid;

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.channelsService.getAllin(uuid, page, limit, offset);
	}

	/**
	 * Get one
	 */
	@ApiTags('chats · channels')
	@ApiResponse({ status: 200, description: 'Channel details', type: ChannelGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Get(':uuid')
	async getOne(@Request() req: Req, @Param('uuid') channel_uuid: string) {
		if (!isUUID(channel_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const uuid = (req.user as JwtData).infos.uuid;

		return await this.channelsService.getOne(channel_uuid, uuid);
	}

	/**
	 * Find one private
	 */
	@ApiTags('chats · channels')
	@ApiBody({ type: ChannelPrivateProperty })
	@ApiResponse({ status: 200, description: 'Private uuid', type: ChannelPrivateGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Post('private')
	async findPriv(@Body() body: ChannelPrivateProperty) {
		if (body.identifier === undefined || isEmpty(body.name)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		return await this.channelsService.findPriv(body);
	}

	/**
	 * Create / Join
	 */
	@ApiTags('chats · channels')
	@ApiBody({
		type: ChannelsCreateProperty,
		examples: {
			['Create public']: {
				value: {
					type: ChannelType.Public,
					name: 'string',
				} as ChannelsCreateProperty,
			},
			['Create public with password']: {
				value: {
					type: ChannelType.Public,
					name: 'string',
					password: 'string',
				} as ChannelsCreateProperty,
			},
			['Create private']: {
				value: {
					type: ChannelType.Private,
					name: 'string',
					password: 'string',
				} as ChannelsCreateProperty,
			},
			['Create direct']: {
				value: {
					user_uuid: 'string',
				} as ChannelsCreateProperty,
			},
			['Join public']: {
				value: {
					channel_uuid: 'string',
				} as ChannelsCreateProperty,
			},
			['Join public with password']: {
				value: {
					channel_uuid: 'string',
					password: 'string',
				} as ChannelsCreateProperty,
			},
			['Join private']: {
				value: {
					identifier: 9999,
					name: 'string',
					password: 'string',
				} as ChannelsCreateProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'Joined' })
	@ApiResponse({ status: 201, description: 'Created' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.WrongPassword })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyInChannel })
	@ApiResponse({ status: 400.3, description: ApiResponseError.ChannelNotFound })
	@ApiResponse({ status: 400.4, description: ApiResponseError.DirectYourseft })
	@ApiResponse({ status: 400.5, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.6, description: ApiResponseError.AlreadyDirect })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Post()
	async join(
		@Request() req: Req,
		@Response({ passthrough: true }) res: Res,
		@Body() body: ChannelsCreateProperty,
	) {
		const user = (req.user as JwtData).infos;

		const params: ChannelsCreateProperty = {
			type: body.type,
			identifier: body.identifier,
			name: body.name,
			password: body.password,
			current_user: user,
			user_uuid: body.user_uuid,
			channel_uuid: body.channel_uuid,
		};

		const joined = await this.channelsService.join(params);
		if (joined) {
			res.status(201);
			return joined;
		}
	}

	/**
	 * Leave
	 */
	@ApiTags('chats · channels')
	@ApiBody({
		type: ChannelLeaveProperty,
		examples: {
			['Leave channel']: {
				value: {
					action: LeaveAction.Leave,
				} as ChannelLeaveProperty,
			},
			['Delete channel']: {
				value: {
					action: LeaveAction.Remove,
				} as ChannelLeaveProperty,
			},
			['Kick user from channel']: {
				value: {
					action: LeaveAction.Kick,
					user_uuid: 'string',
				} as ChannelLeaveProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'Left' })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Delete(':uuid')
	async leave(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelLeaveProperty,
	) {
		if (
			!isUUID(channel_uuid, 4) ||
			isEmpty(body.action) ||
			(body.action === 'KICK' && !isUUID(body.user_uuid, 4))
		) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}
		const user = (req.user as JwtData).infos;

		await this.channelsService.leave({
			action: body.action,
			user_uuid: body.user_uuid,
			current_user: user,
			channel_uuid,
		});
	}
	//#endregion

	/**
	 * Moderation
	 */
	//#region

	/**
	 * Get blacklisted users
	 */
	@ApiTags('chats · moderation')
	@ApiResponse({ status: 200, description: 'Blacklist', type: BlacklistGetResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyModerator })
	@ApiResponse({ status: 400.3, description: ApiResponseError.isAdministrator })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Get(':uuid/blacklist')
	async getBlacklist(@Request() req: Req, @Param('uuid') channel_uuid: string) {
		if (!isUUID(channel_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		return await this.channelsService.blacklist.get({
			current_user: user,
			channel_uuid,
		});
	}

	/**
	 * Add moderator
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Add moderator']: {
				value: {
					user_uuid: 'string',
				} as ChannelModerationProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'User promoted' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyModerator })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Put(':uuid/moderator')
	async addModerator(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4) || body.expiration) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Promote,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Remove moderator
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Remove moderator']: {
				value: {
					user_uuid: 'string',
				} as ChannelModerationProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'User demoted' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyModerator })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Delete(':uuid/moderator')
	async removeModerator(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4) || body.expiration) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Demote,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Ban
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Ban']: {
				value: {
					user_uuid: 'string',
					expiration: 60,
				} as ChannelModerationProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'User banned' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.3, description: ApiResponseError.AlreadyModerator })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Put(':uuid/ban')
	async ban(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Ban,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Unban
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Unban']: {
				value: {
					user_uuid: 'string',
				} as ChannelModerationProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'User banned' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Delete(':uuid/unban')
	async unban(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4) || body.expiration) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Unban,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Mute
	 */
	@ApiTags('chats · moderation')
	@ApiResponse({ status: 200, description: 'User forgiven' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Mute']: {
				value: {
					user_uuid: 'string',
					expiration: 60,
				} as ChannelModerationProperty,
			},
		},
	})
	@Put(':uuid/mute')
	async mute(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Mute,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Unmute
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelModerationProperty,
		examples: {
			['Unmute']: {
				value: {
					user_uuid: 'string',
				} as ChannelModerationProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'User unmuted' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Delete(':uuid/unmute')
	async unmute(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModerationProperty,
	) {
		if (!isUUID(channel_uuid, 4) || !isUUID(body.user_uuid, 4) || body.expiration) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.moderation.dispatch({
			action: ChatAction.Unmute,
			current_user: user,
			user_uuid: body.user_uuid,
			expiration: body.expiration,
			channel_uuid,
			avatar: null,
		});
	}

	/**
	 * Settings
	 */

	/**
	 * Password
	 */
	@ApiTags('chats · moderation')
	@ApiBody({
		type: ChannelSettingProperty,
		examples: {
			['Add/change password']: {
				value: {
					password: 'string',
				} as ChannelSettingProperty,
			},
			['Remove password']: {
				value: {
					password: null,
				} as ChannelSettingProperty,
			},
		},
	})
	@ApiResponse({ status: 200, description: 'Setting successfully updated' })
	@ApiResponse({ status: 400, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Patch(':uuid')
	async password(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelSettingProperty,
	) {
		if (!isUUID(channel_uuid, 4) || isEmpty(body.password) || !isEmpty(body.avatar)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		await this.channelsService.password({
			channel_uuid,
			current_user: user,
			password: body.password,
		});
	}

	//#endregion

	/**
	 * Messages
	 */
	//#region

	/**
	 * Get
	 */
	@ApiTags('chats · messages')
	@ApiQuery({ type: MessagesGetProperty })
	@ApiResponse({ status: 200, description: "Channel's messages", type: MessagesGetResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.InvalidQuery })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Get(':uuid/messages')
	async getMessages(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any,
	) {
		if (!isUUID(channel_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });

		return await this.messagesService.get(channel_uuid, user, page, limit, offset);
	}

	/**
	 * Store
	 */
	@ApiTags('chats · messages')
	@ApiBody({ type: MessageStoreProperty })
	@ApiResponse({ status: 201, description: 'Created and brodcasted' })
	@ApiResponse({ status: 400.1, description: ApiResponseErrorGlobal.MissingParameters })
	@ApiResponse({ status: 400.2, description: ApiResponseError.EmptyMessage })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(201)
	@Post(':uuid/messages')
	async addMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: MessageStoreProperty,
	) {
		if (!isUUID(channel_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		if (isEmpty(body.message)) {
			throw new BadRequestException(ApiResponseError.EmptyMessage);
		}

		const user = (req.user as JwtData).infos;

		await this.messagesService.store({
			current_user: user,
			channel_uuid,
			message: body.message,
		});
	}

	/**
	 * Delete
	 */
	@ApiTags('chats · messages')
	@ApiBody({ type: MessageDeleteProperty })
	@ApiResponse({ status: 200, description: 'Deleted' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.MissingUUID })
	@ApiResponse({ status: 400.2, description: ApiResponseError.MissingUUID })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.MessageNotFound })
	@HttpCode(200)
	@Delete(':uuid/messages')
	async deleteMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: { uuid: string },
	) {
		if (!isUUID(channel_uuid, 4)) {
			throw new BadRequestException(ApiResponseErrorGlobal.MissingParameters);
		}

		if (!isUUID(body.uuid, 4)) {
			throw new BadRequestException(ApiResponseError.MissingUUID);
		}

		const user_uuid = (req.user as JwtData).infos.uuid;

		await this.messagesService.delete(channel_uuid, user_uuid, body.uuid);
	}
	//#endregion
}
