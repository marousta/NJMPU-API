import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { UsersInfos } from './users.entity';
import { genIdentifier } from '../utils';
import { WsService } from '../websockets/ws.service';
import { UserAction, WsNamespace } from 'src/websockets/types';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly wsService: WsService
	) {}

	async getIdentfier(username: string) {
		while (true) {
			const users = await this.usersRepository.find({
				select: { identifier: true },
				where: { username }
			});
			const exclude: number[] = [];
			users?.forEach((u) => exclude.push(u.identifier));

			const id = genIdentifier(exclude);
			if (id === null) {
				username += Math.floor(Math.random() * 10);
				continue;
			}
			return id;
		}
	}

	async get(uuid: string) {
		const { email, password, twofactor, ...filtered } = await this.usersRepository
			.findOneByOrFail({ uuid })
			.catch((e) => {
				this.logger.verbose(uuid + ' not found', e);
				throw new NotFoundException();
			});
		return filtered;
	}

	async avatar(uuid: string, avatar: string) {
		const user = await this.usersRepository
			.findOneByOrFail({
				uuid
			})
			.catch((e) => {
				this.logger.error('Unable to find user ' + uuid, e);
				throw new InternalServerErrorException();
			});

		const old_avatar = avatar;
		user.avatar = avatar;

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to update avatar for user ' + uuid, e);
			throw new InternalServerErrorException();
		});

		this.wsService.dispatch.all({
			namespace: WsNamespace.User,
			action: UserAction.Avatar,
			user: user.uuid
		});

		return { new: avatar, old: old_avatar };
	}
}
