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
	ForbiddenException
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req, Response as Res } from 'express';

import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';
import { WsService } from '../websockets/ws.service';

import { ChannelsCreateProperty } from './properties/channels.create.property';
import { ChannelsGetResponse, ChannelGetResponse } from './properties/channels.get.property';
import { MessageStoreProperty } from './properties/messages.store.property';
import { MessagesGetProperty, MessagesGetResponse } from './properties/messages.get.propoerty';
import { MessageDeleteProperty } from './properties/message.delete.property';
import { GlobalQueryProperty } from '../global.property';

import { isEmpty, parseUnsigned } from '../utils';
import { ChannelType } from './types';

@UseGuards(AuthGuard('access'))
@ApiTags('chats')
@Controller('chats/channels')
export class ChatsController {
	constructor(
		private readonly channelsService: ChannelsService,
		private readonly messagesService: MessagesService,
		private readonly wsService: WsService
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
	@ApiResponse({ status: 400, description: 'Invalid number in query' })
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
	@ApiResponse({ status: 400, description: 'Invalid number in query' })
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
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 404, description: "Channel doesn't exist" })
	@HttpCode(200)
	@Get(':uuid')
	async getOne(@Request() req: Req, @Param('uuid') channel_uuid: string) {
		const uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException();
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
	@ApiResponse({ status: 400.1, description: 'Wrong password' })
	@ApiResponse({ status: 400.2, description: 'User already in this channel' })
	@ApiResponse({ status: 400.3, description: "Channel doesn't exist" })
	@ApiResponse({ status: 400.4, description: "User can't DM herself" })
	@ApiResponse({ status: 400.5, description: "Remote user doesn't exist" })
	@ApiResponse({ status: 400.6, description: 'Direct message with this user already exist' })
	@ApiResponse({ status: 401, description: "User doesn't exist" })
	@ApiResponse({ status: 404, description: 'Channel not found' })
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
	 * Leave
	 */
	@ApiResponse({ status: 200, description: 'Leaved' })
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 403, description: 'User not in channel' })
	@ApiResponse({ status: 404, description: 'Channel not found' })
	@HttpCode(200)
	@Delete(':uuid')
	async leave(@Request() req: Req, @Param('uuid') channel_uuid: string) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException();
		}

		await this.channelsService.leave(channel_uuid, user_uuid);
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
	@ApiResponse({ status: 400.1, description: 'Missing channel uuid' })
	@ApiResponse({ status: 400.2, description: 'Invalid number in query' })
	@ApiResponse({ status: 403, description: 'User not in channel' })
	@ApiResponse({ status: 404, description: 'Channel not found' })
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
			throw new BadRequestException('Missing channel uuid');
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
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 400, description: 'Empty message' })
	@ApiResponse({ status: 403, description: 'User not in channel' })
	@ApiResponse({ status: 404, description: 'Channel not found' })
	@HttpCode(201)
	@Post(':uuid/messages')
	async addMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: MessageStoreProperty
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException('Missing channel uuid');
		}

		if (isEmpty(body.message)) {
			throw new BadRequestException('Empty message');
		}

		const userInChannel = await this.channelsService.userInChannelFind(channel_uuid, user_uuid);
		if (!userInChannel) {
			throw new ForbiddenException("You're not in this channel");
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
	@ApiResponse({ status: 400.1, description: 'Missing channel uuid' })
	@ApiResponse({ status: 400.2, description: 'Missing mesasge id' })
	@ApiResponse({ status: 400.3, description: "You can't leave direct channel" })
	@ApiResponse({ status: 403, description: 'User not in channel' })
	@HttpCode(200)
	@Delete(':uuid/messages')
	async deleteMessage(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@Body() body: { id: any }
	) {
		const user_uuid = (req.user as any).uuid;

		if (!channel_uuid) {
			throw new BadRequestException('Missing channel uuid');
		}

		const id = parseUnsigned({ id: body.id });
		if (!id) {
			throw new BadRequestException('Missing mesasge id');
		}

		const userInChannel = await this.channelsService.userInChannelFind(channel_uuid, user_uuid);
		if (!userInChannel) {
			throw new ForbiddenException("You're not in this channel");
		}

		await this.messagesService.delete(id);
	}
	//#endregion
}
