import {
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	Logger,
	InternalServerErrorException,
	Request,
	Param,
	HttpCode
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { renameSync } from 'fs';
import { extname } from 'path';

import { PicturesService } from './pictures.service';

import { AccessAuthGuard } from '../auth/guards/access.guard';
import { Request as Req } from 'express';
import { ApiResponseError } from '../chats/types';
import { PicturesReponse } from './types';
import { PicturesInterceptor } from './pictures.interceptor';
import { ChatAction } from 'src/websockets/types';

@UseGuards(AccessAuthGuard)
@ApiTags('avatar')
@Controller('avatar')
export class PicturesController {
	private readonly logger = new Logger(PicturesController.name);
	constructor(private readonly picturesService: PicturesService) {}

	private rename(file: Express.Multer.File) {
		if (!file) {
			return null;
		}

		const filename = this.picturesService.folder + '/' + file.filename;
		const renamed = file.filename + extname(file.originalname);
		const renamed_path = this.picturesService.folder + '/' + renamed;

		try {
			renameSync(filename, renamed_path);
		} catch (e) {
			this.logger.error('Unable to create image file', e);
			throw new InternalServerErrorException();
		}

		return renamed;
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
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesReponse })
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

		const filename = this.rename(file);

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
	@ApiResponse({ status: 200, description: 'Successfully uploaded', type: PicturesReponse })
	@ApiResponse({ status: 413, description: ApiResponseError.ImgTooLarge })
	@HttpCode(200)
	@Post('user')
	@UseInterceptors(PicturesInterceptor)
	async userAvatar(@Request() req: Req, @UploadedFile() file: Express.Multer.File) {
		const user_uuid = (req.user as any).uuid;

		const filename = this.rename(file);

		return await this.picturesService.update.user({
			action: ChatAction.Avatar,
			avatar: filename,
			current_user_uuid: user_uuid
		});
	}
}
