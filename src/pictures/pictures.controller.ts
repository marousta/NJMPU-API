import {
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	Logger,
	Request,
	Param,
	HttpCode,
	InternalServerErrorException
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { PicturesService } from './pictures.service';

import { PicturesInterceptor } from './pictures.interceptor';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { FileInterceptorBody } from './pictures.property';

import { PicturesResponse } from './types';
import { ApiResponseError } from '../chats/types';
import { ChatAction } from '../websockets/types';

@UseGuards(AccessAuthGuard)
@Controller('chats/channels')
export class PicturesChatsController {
	private readonly logger = new Logger(PicturesChatsController.name);
	constructor(private readonly picturesService: PicturesService) {}

	@ApiTags('chats · moderation')
	@ApiConsumes('multipart/form-data')
	@ApiBody(FileInterceptorBody)
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesResponse })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post(':uuid/avatar')
	@UseInterceptors(PicturesInterceptor)
	async channelAvatar(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@UploadedFile() file: Express.Multer.File
	) {
		const user_uuid = (req.user as any).uuid;

		let filename: string;
		try {
			filename = this.picturesService.stripExif(file);
		} catch (e) {
			this.logger.error('Unable to create image file', e);
			throw new InternalServerErrorException();
		}

		return await this.picturesService.update.channel({
			action: ChatAction.Avatar,
			avatar: filename,
			current_user_uuid: user_uuid,
			channel_uuid: channel_uuid
		});
	}
}

@UseGuards(AccessAuthGuard)
@Controller('users/avatar')
export class PicturesUsersController {
	private readonly logger = new Logger(PicturesUsersController.name);
	constructor(private readonly picturesService: PicturesService) {}

	@ApiTags('users · account')
	@ApiConsumes('multipart/form-data')
	@ApiBody(FileInterceptorBody)
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesResponse })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post()
	@UseInterceptors(PicturesInterceptor)
	async userAvatar(@Request() req: Req, @UploadedFile() file: Express.Multer.File) {
		const user_uuid = (req.user as any).uuid;

		let filename: string;
		try {
			filename = this.picturesService.stripExif(file);
		} catch (e) {
			this.logger.error('Unable to create image file', e);
			throw new InternalServerErrorException();
		}

		return await this.picturesService.update.user({
			action: ChatAction.Avatar,
			avatar: filename,
			current_user_uuid: user_uuid
		});
	}
}
