import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { createHash } from 'crypto';

@Injectable()
export class PictureService {
	constructor(private httpService: HttpService) {}

	private parseContentType(type: string) {
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
				throw new Error(
					'Unsupported file format expected [jpg, jpeg, jfif, png, apng, gif, webp] got [' + arr[1] + ']'
				);
		}
	}

	// Debug purpose
	private bufferToHex(buff: Buffer) {
		const json = Buffer.from(buff).toJSON();
		let hex = '';
		for (const b of json.data) {
			hex += b.toString(16);
		}
		return hex;
	}

	private async fetch(path: string) {
		const fetched = await this.httpService
			.axiosRef({
				url: path,
				method: 'get',
				responseType: 'arraybuffer'
			})
			.then((res) => {
				const content_type = this.parseContentType(res.headers['content-type']);
				return { content_type, data: Buffer.from(res.data, 'binary') };
			});
		return { format: fetched.content_type, data: fetched.data };
	}

	async download(username: string, identifier: number, url: string): Promise<string> {
		const shared = resolve('shared');
		if (!existsSync(shared)) {
			mkdirSync(shared);
		}

		let path: string;
		const usernameid = username + '_' + identifier;

		const shared_dir = readdirSync(shared);
		const user_picture = shared_dir.filter((i) => basename(i, extname(i)) === usernameid)[0];

		const img = await this.fetch(url);
		if (user_picture) {
			path = shared + '/' + user_picture;
			const user_picture_data = readFileSync(path);
			const md5_actual = createHash('sha1').update(user_picture_data).digest();
			const md5_new = createHash('sha1').update(img.data).digest();
			// console.log(this.bufferToHex(md5_actual), this.bufferToHex(md5_new)); // Debug
			if (md5_actual === md5_new) {
				return user_picture;
			}
			rmSync(path);
		}
		const newImg = usernameid + '.' + img.format;
		path = shared + '/' + newImg;
		writeFileSync(path, img.data);
		return newImg;
	}
}
