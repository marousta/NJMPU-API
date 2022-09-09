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
	UseGuards
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req, Response as Res } from 'express';

import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';

import { ChannelsCreateProperty } from './properties/channels.create.property';
import {
	ChannelsGetProperty,
	ChannelsGetReponse,
	ChannelGetReponse
} from './properties/channels.get.property';
import { MessageStoreProperty } from './properties/messages.store.property';
import { MessagesGetProperty, MessagesGetReponse } from './properties/messages.get.propoerty';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isEmpty, parseUnsigned } from '../utils';
import { MessageDeleteProperty } from './properties/message.delete.property';
import { WsService } from '../websockets/ws.service';

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
	@ApiQuery({ type: ChannelsGetProperty })
	@ApiResponse({ status: 200, description: 'List of channels', type: ChannelsGetReponse })
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
	 * Get one
	 */
	@ApiResponse({ status: 200, description: 'Channel details', type: ChannelGetReponse })
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 404, description: "Channel doesn't exist" })
	@HttpCode(200)
	@Get(':uuid')
	async getOne(@Param('uuid') channel_uuid: string) {
		if (!channel_uuid) {
			throw new BadRequestException();
		}
		return await this.channelsService.getOne(channel_uuid);
	}

	/**
	 * Create / Join
	 */
	@ApiBody({
		type: ChannelsCreateProperty,
		examples: {
			Create: {
				value: { name: 'string' } as ChannelsCreateProperty
			},
			['Create with password']: {
				value: { name: 'string', password: 'string' } as ChannelsCreateProperty
			},
			Join: {
				value: { channel_uuid: 'string' } as ChannelsCreateProperty
			},
			['Join with password']: {
				value: { channel_uuid: 'string', password: 'string' } as ChannelsCreateProperty
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Joined' })
	@ApiResponse({ status: 201, description: 'Created' })
	@ApiResponse({ status: 400, description: 'Wrong password' })
	@ApiResponse({ status: 404, description: 'Channel not found' })
	@HttpCode(200)
	@Post()
	async join(
		@Request() req: Req,
		@Response({ passthrough: true }) res: Res,
		@Body() body: ChannelsCreateProperty
	) {
		const uuid = (req.user as any).uuid;

		const joined = await this.channelsService.join({
			name: body.name,
			user_uuid: uuid,
			password: body.password,
			channel_uuid: body.channel_uuid
		});
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

		if (!(await this.channelsService.userInChannel(channel_uuid, user_uuid))) {
			throw new ForbiddenException();
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
	@ApiResponse({ status: 200, description: "Channel's messages", type: MessagesGetReponse })
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 400, description: 'Invalid number' })
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
		if (!(await this.channelsService.userInChannel(channel_uuid, user_uuid))) {
			throw new ForbiddenException();
		}
		page = parseUnsigned({ page });
		limit = parseUnsigned({ limit });
		offset = parseUnsigned({ offset });
		return await this.messagesService.get(channel_uuid, page, limit, offset);
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

		if (!(await this.channelsService.userInChannel(channel_uuid, user_uuid))) {
			throw new ForbiddenException();
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
	@ApiResponse({ status: 400, description: 'Missing channel uuid' })
	@ApiResponse({ status: 400, description: 'Missing mesasge id' })
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

		if (!(await this.channelsService.userInChannel(channel_uuid, user_uuid))) {
			throw new ForbiddenException();
		}

		await this.messagesService.delete(id);
	}
	//#endregion
}
