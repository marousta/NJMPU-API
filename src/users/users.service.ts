import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';

import { UsersInfos } from './users.entity';

@Injectable()
export class UsersService extends TypeOrmCrudService<UsersInfos> {
	constructor(@InjectRepository(UsersInfos) repo: Repository<UsersInfos>) {
		super(repo);
	}

	private genIdentifier(exclude: number[]): number | null {
		const randomEntry = (array: number[]): number => {
			const randomIndex = Math.floor(Math.random() * array.length);
			return array[randomIndex];
		};

		const genArray = (): number[] => {
			let arr: number[] = [];
			for (let i = 0; i <= 9999; ++i) {
				arr.push(i);
			}
			return arr;
		};

		const filtered = genArray().filter((i) => !exclude.includes(i));
		if (filtered.length) {
			return randomEntry(filtered);
		}
		return null;
	}

	async getIdentfier(username: string) {
		while (true) {
			const users = await this.repo.find({
				select: { identifier: true },
				where: { username }
			});
			const ids = users.map((u) => u.identifier);

			const id = this.genIdentifier(ids);
			if (id === null) {
				username += Math.floor(Math.random() * 100);
				continue;
			}
			return id;
		}
	}
}
