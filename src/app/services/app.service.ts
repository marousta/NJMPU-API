import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawnSync } from 'child_process';
import * as TwoFactor from 'node-2fa';

import { UsersService } from 'src/users/services/users.service';
import { ChannelsService } from '../../chats/services/channels.service';

import { UsersInfos } from '../../users/entities/users.entity';

import { ChannelType } from '../../chats/types';

@Injectable()
export class AppService {
	private readonly logger = new Logger(AppService.name);
	constructor(
		private readonly configService: ConfigService,
		private readonly usersService: UsersService,
		private readonly channelsService: ChannelsService
	) {
		this.createAdmin();
	}

	private rootInfos(root: UsersInfos, token: any) {
		this.logger.log('');
		this.logger.log('');
		this.logger.log('Created root user');
		this.logger.log('');
		this.logger.log('Email: ' + root.email);
		this.logger.log('Username: ' + root.username);
		this.logger.log('');

		// Print QRCode if qrencode dependency is installed
		this.logger.log('2FA');
		try {
			const args = [`-t`, `utf8`, `${token.uri}`];
			const qr = spawnSync(`/usr/bin/qrencode`, args).stdout.toString();
			qr.split('\n').forEach((line) => {
				this.logger.log(line);
			});
		} catch (e) {}
		this.logger.log(token.secret);
		this.logger.log('Connect to your profile and change this now.');

		this.logger.log('');
		this.logger.log('');
	}

	private async createAdmin() {
		const email = this.configService.get<string>('ROOT_EMAIL');
		const username = this.configService.get<string>('ROOT_USERNAME');
		const password = this.configService.get<string>('ROOT_PASSWORD');
		const channel = this.configService.get<boolean>('ROOT_CHANNEL');
		const channel_name = this.configService.get<string>('ROOT_CHANNEL_NAME');

		if (!email && !username && !password) {
			return;
		}

		if (!email || !username || !password) {
			this.logger.warn('Incomplete administrator credentials, ignoring it');
			return;
		}

		const exist = await this.usersService.findWithRelationsOrNull({ email }, 'ignored');
		if (exist) {
			this.logger.log('Root user is present');

			if (!exist.adam) {
				exist.adam = true;
				await this.usersService.save(exist).catch((e) => {
					this.logger.error(e);
					process.exit(1);
				});
				this.logger.debug('hotfixed');
			}
			return;
		}

		const token = TwoFactor.generateSecret({
			name: 'NEW SHINJI MEGA PONG ULTIMATE',
			account: email
		});

		const root = await this.usersService.create({
			adam: true,
			identifier: 0,
			username,
			password,
			confirm: password,
			email,
			avatar: null,
			twofactor: token.secret
		});

		this.rootInfos(root, token);

		if (channel) {
			await this.channelsService.join({
				default: true,
				identifier: 0,
				current_user: root,
				type: ChannelType.Public,
				name: channel_name ? channel_name : 'General'
			});
			this.logger.log('Created default channel');
		}
	}
}
