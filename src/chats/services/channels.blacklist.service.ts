import {
	Injectable,
	Logger,
	BadRequestException,
	InternalServerErrorException,
	NotFoundException,
	Inject,
	forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChannelsService } from './channels.service';

import { ChatsChannelsBlacklist } from '../entities/channels.blacklist.entity';
import { ChatsChannelsID } from '../entities/channels.entity';

import { BlacklistGetResponse } from '../properties/channels.blacklist.get.property';
import { ChannelModeratorProperty } from '../properties/channels.update.property';

import { BlacklistType, ApiResponseError } from '../types';
import { ChatAction } from '../../websockets/types';

@Injectable()
export class ChannelsBlacklistService {
	private readonly logger = new Logger(ChannelsBlacklistService.name);
	constructor(
		@InjectRepository(ChatsChannelsBlacklist)
		private readonly blacklistRepository: Repository<ChatsChannelsBlacklist>,
		@Inject(forwardRef(() => ChannelsService))
		private readonly channelsService: ChannelsService
	) {}

	/**
	 * Utils
	 */
	private validateType(action: ChatAction) {
		switch (action) {
			case ChatAction.Ban:
			case ChatAction.Unban:
				return BlacklistType.Ban;
			case ChatAction.Mute:
			case ChatAction.Unmute:
				return BlacklistType.Mute;
			default:
				throw new BadRequestException();
		}
	}

	private async checkExpiration(entry: boolean | ChatsChannelsBlacklist) {
		if (!entry) {
			return true;
		}

		entry = entry as ChatsChannelsBlacklist;

		if (!entry.expiration) {
			return false;
		}

		const now = new Date().valueOf();
		const isExpired = now >= entry.expiration.valueOf();

		if (isExpired) {
			await this.remove(
				entry.id,
				('Unable to delete entry ' +
					entry.id +
					' in blacklist for channel ' +
					entry.channel) as string
			);
		}

		return isExpired;
	}

	async isBanned(channel_uuid: string, user_uuid: string) {
		const entry = await this.blacklistRepository
			.findOneByOrFail({
				type: BlacklistType.Ban,
				user: { uuid: user_uuid },
				channel: { uuid: channel_uuid }
			})
			.catch((e) => false);

		const isExpired = await this.checkExpiration(entry);
		return !isExpired;
	}

	async isMuted(channel_uuid: string, user_uuid: string) {
		const entry = await this.blacklistRepository
			.findOneByOrFail({
				type: BlacklistType.Mute,
				user: { uuid: user_uuid },
				channel: { uuid: channel_uuid }
			})
			.catch((e) => false);

		const isExpired = await this.checkExpiration(entry);
		return !isExpired;
	}

	async remove(id: number, error_msg: string) {
		await this.blacklistRepository.delete(id).catch((e) => {
			this.logger.error(error_msg, e);
			throw new InternalServerErrorException();
		});
	}

	/**
	 * Service
	 */
	async create(params: ChannelModeratorProperty, channel: ChatsChannelsID) {
		// Get remote user
		// should not fail
		const user = await this.channelsService.user.find500(params.user_uuid);

		const type = this.validateType(params.action);

		switch (type) {
			case BlacklistType.Ban:
				const isBanned = await this.isBanned(channel.uuid, user.uuid);
				if (isBanned) {
					throw new BadRequestException(ApiResponseError.AlreadyBanned);
				}
				break;
			case BlacklistType.Mute:
				const isMuted = await this.isMuted(channel.uuid, user.uuid);
				if (isMuted) {
					throw new BadRequestException(ApiResponseError.AlreadyMuted);
				}
				break;
		}

		// Create blacklist class entry
		const entry = this.blacklistRepository.create({
			type,
			channel: channel,
			user: user,
			expiration: params.expiration
		});

		// Save to database
		await this.blacklistRepository.save(entry).catch((e) => {
			this.logger.error(
				'Unable to create ' +
					params.action +
					' entry in blacklist for channel ' +
					channel.uuid,
				e
			);
			throw new InternalServerErrorException();
		});

		return channel;
	}

	async delete(params: ChannelModeratorProperty, channel: ChatsChannelsID) {
		const entry = await this.blacklistRepository
			.createQueryBuilder('entry')
			.where({
				type: this.validateType(params.action),
				user: params.user_uuid,
				channel: channel.uuid
			})
			.loadAllRelationIds()
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose(
					'Unable to find entry in blacklist for channel ' + channel.uuid,
					e
				);
				throw new NotFoundException(ApiResponseError.BlacklistEntryNotFound);
			});

		await this.remove(
			entry.id,
			'Unable to delete entry ' + entry.id + ' in blacklist for channel ' + channel.uuid
		);

		return channel;
	}

	async get(channel_uuid: string) {
		const entries = await this.blacklistRepository
			.createQueryBuilder('entry')
			.where({ channel: channel_uuid })
			.loadAllRelationIds()
			.getMany()
			.catch((e) => {
				this.logger.error(
					'Unable to find entry in blacklist for channel ' + channel_uuid,
					e
				);
				throw new InternalServerErrorException();
			});

		let filtered: BlacklistGetResponse = {
			banned: [],
			muted: []
		};
		entries.forEach((e) => {
			switch (e.type) {
				case BlacklistType.Ban:
					filtered.banned.push({
						user: e.user as any as string,
						expiration: e.expiration
					});
					break;
				case BlacklistType.Mute:
					filtered.muted.push({
						user: e.user as any as string,
						expiration: e.expiration
					});
					break;
				default:
					throw new InternalServerErrorException();
			}
		});
		return filtered;
	}
}
