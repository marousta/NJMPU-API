import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { UsersInfos } from './users.entity';
import { genIdentifier } from '../utils';

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	constructor(
		@InjectRepository(UsersInfos) private readonly usersRepository: Repository<UsersInfos>
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
}
