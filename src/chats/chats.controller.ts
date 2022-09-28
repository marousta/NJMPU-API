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
	Patch
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req, Response as Res } from 'express';

import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';

import { ChannelsCreateProperty } from './properties/channels.create.property';
import { ChannelsGetResponse, ChannelGetResponse } from './properties/channels.get.property';
import { MessageStoreProperty } from './properties/messages.store.property';
import { MessagesGetProperty, MessagesGetResponse } from './properties/messages.get.propoerty';
import { MessageDeleteProperty } from './properties/message.delete.property';
import { GlobalQueryProperty } from '../global.property';

import { isEmpty, parseUnsigned } from '../utils';
import { ChannelType, ApiResponseError } from './types';
import { ChannelSettingProperty } from './properties/channels.update.property';
import { ChannelLeaveProperty, LeaveAction } from './properties/channels.delete.property';
import {
	ChannelModeratorProperty,
	ChannelModeratorState
} from './properties/channels.update.property';

@UseGuards(AuthGuard('access'))
@ApiTags('chats')
@Controller('chats/channels')
export class ChatsController {
	constructor(
		private readonly channelsService: ChannelsService,
		private readonly messagesService: MessagesService
	) {}

	/**
	 * Channels
	 */
	//#region  Channels

	/**
	 * Get all
	 */
	@ApiQuery({ type: GlobalQueryProperty })
	@ApiResponse({ status: 200, description: 'List of channels', type: ChannelsGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseError.InvalidQuery })
	@HttpCode(200)
	@Get()
	async getAll(
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any
	) {
		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });
		return await this.channelsService.getAll(page, limit, offset);
	}

	/**
	 * Get all in
	 */
	@ApiQuery({ type: GlobalQueryProperty })
	@ApiResponse({ status: 200, description: 'List of joined channels', type: ChannelsGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseError.InvalidQuery })
	@HttpCode(200)
	@Get('/in')
	async getAllin(
		@Request() req: Req,
		@Query('page') page: any,
		@Query('limit') limit: any,
		@Query('offset') offset: any
	) {
		const uuid = (req.user as any).uuid;
		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });
		return await this.channelsService.getAllin(uuid, page, limit, offset);
	}

	/**
	 * Get one
	 */
	@ApiResponse({ status: 200, description: 'Channel details', type: ChannelGetResponse })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Get(':uuid')
	async getOne(@Request() req: Req, @Param('uuid') channel_uuid: string) {
		const uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}
		return await this.channelsService.getOne(channel_uuid, uuid);
	}

	/**
	 * Create / Join
	 */
	@ApiBody({
		type: ChannelsCreateProperty,
		examples: {
			['Create public']: {
				value: {
					type: ChannelType.Public,
					name: 'string'
				} as ChannelsCreateProperty
			},
			['Create public with password']: {
				value: {
					type: ChannelType.Public,
					name: 'string',
					password: 'string'
				} as ChannelsCreateProperty
			},
			['Create private']: {
				value: {
					type: ChannelType.Private,
					name: 'string',
					password: 'string'
				} as ChannelsCreateProperty
			},
			['Create direct']: {
				value: {
					user_uuid: 'string'
				} as ChannelsCreateProperty
			},
			['Join public']: {
				value: {
					channel_uuid: 'string'
				} as ChannelsCreateProperty
			},
			['Join public with password']: {
				value: {
					channel_uuid: 'string',
					password: 'string'
				} as ChannelsCreateProperty
			},
			['Join private']: {
				value: {
					identifier: 9999,
					name: 'string',
					password: 'string'
				} as ChannelsCreateProperty
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Joined' })
	@ApiResponse({ status: 201, description: 'Created' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.WrongPassword })
	@ApiResponse({ status: 400.2, description: ApiResponseError.AlreadyInChannel })
	@ApiResponse({ status: 400.3, description: ApiResponseError.ChannelNotFound })
	@ApiResponse({ status: 400.4, description: "You can't DM yourself" })
	@ApiResponse({ status: 400.5, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.6, description: 'Direct message with this user already exist' })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Post()
	async join(
		@Request() req: Req,
		@Response({ passthrough: true }) res: Res,
		@Body() body: ChannelsCreateProperty
	) {
		const uuid = (req.user as any).uuid;

		const params: ChannelsCreateProperty = {
			type: body.type,
			identifier: body.identifier,
			name: body.name,
			password: body.password,
			current_user_uuid: uuid,
			user_uuid: body.user_uuid,
			channel_uuid: body.channel_uuid
		};

		const joined = await this.channelsService.join(params);
		if (joined) {
			res.status(201);
			return joined;
		}
	}

	/**
	 * Moderator
	 */
	@ApiBody({
		type: ChannelModeratorProperty,
		examples: {
			['Remove moderator']: {
				value: {
					state: ChannelModeratorState.Remove,
					user_uuid: 'string'
				} as ChannelModeratorProperty
			},
			['Add moderator']: {
				value: {
					state: ChannelModeratorState.Add,
					user_uuid: 'string'
				} as ChannelModeratorProperty
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Moderator successfully added' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 400.2, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 400.3, description: ApiResponseError.RemoteUserNotFound })
	@ApiResponse({ status: 400.4, description: ApiResponseError.NotModerator })
	@ApiResponse({ status: 400.5, description: ApiResponseError.AlreadyModerator })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Put(':uuid')
	async moderators(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelModeratorProperty
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		await this.channelsService.moderators({
			state: body.state,
			current_user_uuid: user_uuid,
			user_uuid: body.user_uuid,
			channel_uuid
		});
	}

	/**
	 * Settings
	 */
	@ApiBody({
		type: ChannelSettingProperty,
		examples: {
			['Add/change password']: {
				value: {
					password: 'string'
				} as ChannelSettingProperty
			},
			['Remove password']: {
				value: {
					password: null
				} as ChannelSettingProperty
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Setting successfully updated' })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@Patch(':uuid')
	async settings(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelSettingProperty
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		await this.channelsService.settings({
			channel_uuid,
			user_uuid,
			password: body.password
		});
	}

	/**
	 * Leave
	 * //TODO: Customize route for leaving, kicking, deleting
	 */
	@ApiBody({
		type: ChannelLeaveProperty,
		examples: {
			['Leave channel']: {
				value: {
					action: LeaveAction.Leave
				} as ChannelLeaveProperty
			},
			['Delete channel']: {
				value: {
					action: LeaveAction.Remove
				} as ChannelLeaveProperty
			},
			['Kick user from channel']: {
				value: {
					action: LeaveAction.Kick
				} as ChannelLeaveProperty
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Left' })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(200)
	@Delete(':uuid')
	async leave(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: ChannelLeaveProperty
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		await this.channelsService.leave({
			action: body.action,
			user: body.user,
			user_uuid,
			channel_uuid
		});
	}
	//#endregion

	/**
	 * Messages
	 */
	//#region  Messages

	/**
	 * Get
	 */
	@ApiQuery({ type: MessagesGetProperty })
	@ApiResponse({ status: 200, description: "Channel's messages", type: MessagesGetResponse })
	@ApiResponse({ status: 400.1, description: ApiResponseError.MissingChannelUUID })
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
		@Query('offset') offset: any
	) {
		const user_uuid = (req.user as any).uuid;
		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });
		return await this.messagesService.get(channel_uuid, user_uuid, page, limit, offset);
	}

	/**
	 * Store
	 */
	@ApiBody({ type: MessageStoreProperty })
	@ApiResponse({ status: 201, description: 'Created and brodcasted' })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 400, description: ApiResponseError.EmptyMessage })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.ChannelNotFound })
	@HttpCode(201)
	@Post(':uuid/messages')
	async addMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: MessageStoreProperty
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		if (isEmpty(body.message)) {
			throw new BadRequestException(ApiResponseError.EmptyMessage);
		}

		await this.messagesService.store({
			user_uuid,
			channel_uuid,
			message: body.message
		});
	}

	/**
	 * Delete
	 */
	@ApiBody({ type: MessageDeleteProperty })
	@ApiResponse({ status: 200, description: 'Deleted' })
	@ApiResponse({ status: 400.1, description: ApiResponseError.MissingChannelUUID })
	@ApiResponse({ status: 400.2, description: ApiResponseError.MissingID })
	@ApiResponse({ status: 403, description: ApiResponseError.NotAllowed })
	@ApiResponse({ status: 404, description: ApiResponseError.MessageNotFound })
	@HttpCode(200)
	@Delete(':uuid/messages')
	async deleteMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: { id: any }
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException(ApiResponseError.MissingChannelUUID);
		}

		const id = parseUnsigned({ id: body.id });
		if (!id) {
			throw new BadRequestException(ApiResponseError.MissingID);
		}

		await this.messagesService.delete(channel_uuid, user_uuid, id);
	}
	//#endregion
}
