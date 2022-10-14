import {
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	Logger,
	Request,
	Param,
	HttpCode
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PicturesService } from './pictures.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';
import { Request as Req } from 'express';
import { ApiResponseError } from '../chats/types';
import { PicturesResponse } from './types';
import { PicturesInterceptor } from './pictures.interceptor';
import { ChatAction } from '../websockets/types';
import { InternalServerErrorException } from '@nestjs/common';

@UseGuards(AccessAuthGuard)
@ApiTags('avatar')
@Controller('avatar')
export class PicturesController {
	private readonly logger = new Logger(PicturesController.name);
	constructor(private readonly picturesService: PicturesService) {}

	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				avatar: {
					type: 'string',
					format: 'binary'
				}
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesResponse })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post('channel/:uuid')
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

	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				avatar: {
					type: 'string',
					format: 'binary'
				}
			}
		}
	})
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesResponse })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post('user')
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
