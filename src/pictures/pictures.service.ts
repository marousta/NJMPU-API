import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { readdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { basename, extname } from 'path';
import { createHash } from 'crypto';

import { ChannelsService } from '../chats/services/channels.service';

import { ChannelAvatarProperty } from '../chats/properties/channels.update.property';
import { UsersService } from '../users/users.service';

@Injectable()
export class PicturesService {
	private readonly logger = new Logger(PicturesService.name);
	folder: string;
	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
		private readonly channelsService: ChannelsService,
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
					'Unsupported file format expected [jpg, jpeg, jfif, png, apng, gif, webp] got [' +
						arr[1] +
						']'
				);
		}
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

	private remove(old_avatar: string) {
		if (!old_avatar) {
			return;
		}

		try {
			rmSync(this.folder + '/' + old_avatar);
		} catch (e) {
			this.logger.error('Unable to remove previous avatar ' + old_avatar, e);
		}
	}

	async download(hash: string, url: string): Promise<string> {
		return new Promise(async (ret) => {
			let path: string;

			const shared_dir = readdirSync(this.folder);
			const user_picture = shared_dir.filter((i) => basename(i, extname(i)) === hash)[0];

			const img = await this.fetch(url);
			if (user_picture) {
				path = this.folder + '/' + user_picture;
				const user_picture_data = readFileSync(path);
				const md5_actual = createHash('sha1').update(user_picture_data).digest('hex');
				const md5_new = createHash('sha1').update(img.data).digest('hex');
				if (md5_actual === md5_new) {
					ret(user_picture);
				}
				rmSync(path);
			}
			const newImg = hash + '.' + img.format;
			path = this.folder + '/' + newImg;
			writeFileSync(path, img.data);
			ret(newImg);
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
}
