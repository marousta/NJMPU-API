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
}
