import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';

import { UsersInfos } from './users.entity';
import { genIdentifier } from '../utils';

@Injectable()
export class UsersService extends TypeOrmCrudService<UsersInfos> {
	constructor(@InjectRepository(UsersInfos) repo: Repository<UsersInfos>) {
		super(repo);
	}

	async getIdentfier(username: string) {
		while (true) {
			const users = await this.repo.find({
				select: { identifier: true },
				where: { username }
			});
			const ids = users.map((u) => u.identifier);

			const id = genIdentifier(ids);
			if (id === null) {
				username += Math.floor(Math.random() * 100);
				continue;
			}
			return id;
		}
	}
}
