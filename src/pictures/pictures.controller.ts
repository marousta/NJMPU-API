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
	BadRequestException
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as Req } from 'express';

import { PicturesService } from './pictures.service';

import { PicturesInterceptor } from './pictures.interceptor';

import { AccessAuthGuard } from '../auth/guards/access.guard';

import { FileInterceptorBody } from './pictures.property';

import { isEmpty } from '../utils';

import { PicturesResponse } from './types';
import { ApiResponseError } from '../chats/types';
import { JwtData } from '../auth/types';

@UseGuards(AccessAuthGuard)
@Controller('chats/channels')
export class PicturesChatsController {
	private readonly logger = new Logger(PicturesChatsController.name);
	constructor(private readonly picturesService: PicturesService) {}

	@ApiTags('chats · moderation')
	@ApiConsumes('multipart/form-data')
	@ApiBody(FileInterceptorBody)
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesResponse })
	@ApiResponse({ status: 400, description: ApiResponseError.MissingParameters })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post(':uuid/avatar')
	@UseInterceptors(PicturesInterceptor)
	async channelAvatar(
		@Request() req: Req,
		@Param('uuid') channel_uuid: string,
		@UploadedFile() file: Express.Multer.File
	) {
		if (isEmpty(channel_uuid) || channel_uuid === 'undefined') {
			throw new BadRequestException(ApiResponseError.MissingParameters);
		}

		const user = (req.user as JwtData).infos;

		const filename = await this.picturesService.processImage(file);

		return await this.picturesService.update.channel(user, filename, channel_uuid);
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
		const user = (req.user as JwtData).infos;

		const filename = await this.picturesService.processImage(file);

		return await this.picturesService.update.user(user, filename);
	}
}
