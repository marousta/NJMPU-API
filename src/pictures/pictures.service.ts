import {
	Injectable,
	Logger,
	BadRequestException,
	Inject,
	forwardRef,
	InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { extname } from 'path';
import * as fs from 'fs';
const ExifTransformer = require('exif-be-gone');
const ffmpeg = require('fluent-ffmpeg');
import { FfprobeData } from 'fluent-ffmpeg';

import { ChannelsService } from '../chats/services/channels.service';
import { UsersService } from '../users/services/users.service';

import { UsersInfos } from '../users/entities/users.entity';

import { MulterFileLike } from './types';

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
		private readonly usersService: UsersService,
	) {
		this.folder = configService.get<string>('IMG_PATH');
	}

	/**
	 * Utils
	 */
	//#region
	//#endregin

	/**
	 * Service
	 */
	//#region

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
						arr[1],
				);
		}
	}

	private stripExif(file: MulterFileLike) {
		// No file, nothing to do, return null to clear avatar
		if (!file) {
			return null;
		}

		// Alias
		const file_path = this.folder + '/' + file.filename;
		const renamed = file.filename + extname(file.originalname);
		const renamed_path = this.folder + '/' + renamed;

		// Init
		const reader = fs.createReadStream(file_path);
		const writer = fs.createWriteStream(renamed_path);

		// Strip Exifs
		reader
			.pipe(new ExifTransformer())
			.pipe(writer)
			.on('finish', () => {
				fs.rmSync(file_path, { force: true });
			});

		// Return final filename
		return renamed;
	}

	private async resize(file: MulterFileLike) {
		// No file, nothing to do, return null to clear avatar
		if (!file) {
			return null;
		}

		// Alias
		const file_path = this.folder + '/' + file.filename;
		let ext = extname(file.originalname);

		// Get Metadata
		const metadata_promise = new Promise((resolve, reject) => {
			ffmpeg.ffprobe(file_path, (err, metadata) => {
				if (err) {
					reject(err);
				}
				resolve(metadata);
			});
		});
		const metadata = (await metadata_promise.then((r) => r)) as FfprobeData;
		const transparency = metadata.streams[0].pix_fmt.includes('a');
		const codec = metadata.streams[0].codec_name;

		// Check if resize isn't needed
		if (metadata.streams[0].width <= 500 && metadata.streams[0].height <= 500) {
			return file;
		}

		// Compress file
		if (!transparency) {
			ext = '.jpeg';
		}
		// Workaround for animated png
		else if (codec === 'apng' || codec === 'webp') {
			ext = '.apng';
		}

		// Resize
		const promise = new Promise((resolve, reject) => {
			ffmpeg(file_path)
				.videoFilter(`crop=w='min(iw\,ih)':h='min(iw\,ih)',scale=500:500,setsar=1`)
				.save(file_path + '_resize' + ext)
				.on('end', () => {
					resolve(true);
				})
				.on('error', (e) => {
					reject(e);
				});
		});
		await promise.then((r) => r);

		// Rename to original param file name
		fs.renameSync(file_path + '_resize' + ext, file_path);

		// Setup for next function
		if (ext === '.apng') {
			ext = '.png';
		}
		file.originalname = file.originalname.replace(/\.[a-z]{3,4}$/gim, ext);

		// Return param
		return file;
	}

	async processImage(file: MulterFileLike) {
		let filename: string = null;
		try {
			file = await this.resize(file);
			filename = this.stripExif(file);
		} catch (e) {
			this.logger.error('Unable to create image file', e);
			throw new InternalServerErrorException();
		}
		return filename;
	}

	private async fetch(path: string) {
		const fetched = await this.httpService
			.axiosRef({
				url: path,
				method: 'get',
				responseType: 'arraybuffer',
			})
			.then((res) => {
				const content_type = PicturesService.parseContentType(res.headers['content-type']);
				return { content_type, data: Buffer.from(res.data, 'binary') };
			});
		return { format: fetched.content_type, data: fetched.data };
	}

	async download(hash: string, url: string): Promise<string> {
		return new Promise(async (resolve) => {
			const img = await this.fetch(url);

			const tmp_path = this.folder + '/' + hash;
			const final = hash + '.' + img.format;
			const final_path = this.folder + '/' + final;

			fs.rmSync(final_path, { force: true });
			fs.writeFileSync(tmp_path, img.data);

			await this.resize({
				filename: hash,
				originalname: final,
			});
			resolve(
				this.stripExif({
					filename: hash,
					originalname: final,
				}),
			);
		});
	}

	readonly update = {
		channel: async (user: UsersInfos, filename: string, channel_uuid: string) => {
			const channel = await this.channelsService.user.hasPermissionsGet(
				channel_uuid,
				user.uuid,
			);

			const avatar = await this.channelsService.moderation.avatar(filename, channel);

			this.remove(avatar.old);

			return { avatar: avatar.new };
		},
		user: async (user: UsersInfos, filename: string) => {
			const avatar = await this.usersService.avatar(user, filename);

			this.remove(avatar.old);

			return { avatar: avatar.new };
		},
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
	//#endregion
}
