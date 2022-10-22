import {
	Injectable,
	Logger,
	BadRequestException,
	InternalServerErrorException,
	Inject
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { extname } from 'path';
import * as fs from 'fs';
import { ExifTransformer } from './exif-be-gone.fixed';

import { ChannelsService } from '../chats/services/channels.service';
import { UsersService } from '../users/services/users.service';

import { ChannelAvatarProperty } from '../chats/properties/channels.update.property';

import { MulterFileLike } from './types';
import { forwardRef } from '@nestjs/common';

@Injectable()
export class PicturesService {
	private readonly logger = new Logger(PicturesService.name);
	folder: string;
	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
		@Inject(forwardRef(() => ChannelsService))
		private readonly channelsService: ChannelsService,
		@Inject(forwardRef(() => UsersService))
		private readonly usersService: UsersService
	) {
		this.folder = configService.get<string>('IMG_PATH');
	}

	static parseContentType(type: string) {
		if (!type || !type.includes('image')) {
			throw new Error('Response Content-Type not matching image type. Received: ' + type);
		}
		const arr = type.split('/');
		switch (arr[1]) {
			case 'jpeg':
			case 'jfif':
				return 'jpg';
			case 'jpg':
			case 'png':
			case 'apng':
			case 'gif':
			case 'webp':
				return arr[1];
			default:
				throw new BadRequestException(
					'Unsupported file format expected [jpg, jpeg, jfif, png, apng, gif, webp] got ' +
						arr[1]
				);
		}
	}

	stripExif(file: MulterFileLike) {
		if (!file) {
			return null;
		}

		const file_path = this.folder + '/' + file.filename;
		const renamed = file.filename + extname(file.originalname);
		const renamed_path = this.folder + '/' + renamed;

		const reader = fs.createReadStream(file_path);
		const writer = fs.createWriteStream(renamed_path);

		reader
			.pipe(new ExifTransformer())
			.pipe(writer)
			.on('finish', () => {
				fs.rmSync(file_path, { force: true });
			});

		return renamed;
	}

	private async fetch(path: string) {
		const fetched = await this.httpService
			.axiosRef({
				url: path,
				method: 'get',
				responseType: 'arraybuffer'
			})
			.then((res) => {
				const content_type = PicturesService.parseContentType(res.headers['content-type']);
				return { content_type, data: Buffer.from(res.data, 'binary') };
			});
		return { format: fetched.content_type, data: fetched.data };
	}

	async download(hash: string, url: string): Promise<string> {
		return new Promise(async (ret) => {
			const img = await this.fetch(url);

			const tmp_path = this.folder + '/' + hash;
			const final = hash + '.' + img.format;
			const final_path = this.folder + '/' + final;

			fs.rmSync(final_path, { force: true });
			fs.writeFileSync(tmp_path, img.data);

			ret(
				this.stripExif({
					filename: hash,
					originalname: final
				})
			);
		});
	}

	readonly update = {
		channel: async (params: ChannelAvatarProperty) => {
			const channel = await this.channelsService.user.hasPermissionsGet(
				params.channel_uuid,
				params.current_user_uuid
			);

			const avatar = await this.channelsService.moderation.avatar(params, channel);

			this.remove(avatar.old);

			return { avatar: avatar.new };
		},
		user: async (params: ChannelAvatarProperty) => {
			const avatar = await this.usersService.avatar(params.current_user_uuid, params.avatar);

			this.remove(avatar.old);

			return { avatar: avatar.new };
		}
	};

	private remove(old_avatar: string) {
		if (!old_avatar) {
			return;
		}

		try {
			fs.rmSync(this.folder + '/' + old_avatar, { force: true });
		} catch (e) {
			this.logger.error('Unable to remove previous avatar ' + old_avatar, e);
		}
	}
}
