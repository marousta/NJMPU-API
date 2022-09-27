import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WsService } from '../../websockets/ws.service';

import { UsersTokens } from '../tokens/tokens.entity';

import { Data, SessionsGetResponse } from './sessions.property';

import { UserAction, WsNamespace } from '../../websockets/types';

@Injectable()
export class SessionsService {
	private readonly logger = new Logger(SessionsService.name);
	constructor(
		@InjectRepository(UsersTokens) private readonly tokenRepository: Repository<UsersTokens>,
		private readonly wsService: WsService
	) {}

	/**
	 * Utils
	 */
	private isActive(date: Date) {
		const offset = 60 * 60 * 24 * 3 * 1000; //3d
		return date.valueOf() + offset > new Date().valueOf();
	}

	/**
	 * Service
	 */
	async get(
		uuid: string,
		page: number = 1,
		limit: number = 0,
		offset: number = 0
	): Promise<SessionsGetResponse> {
		if (page === 0) {
			page = 1;
		}
		const ret = await this.tokenRepository
			.createQueryBuilder('token')
			.leftJoinAndSelect('token.user', 'user')
			.where({ user: uuid })
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.getManyAndCount();

		let data: Data[] = [];
		for (const session of ret[0]) {
			const { id, platform, creation_date, refresh_date } = session;
			data.push({
				id,
				platform,
				creation_date,
				active: this.isActive(refresh_date ? refresh_date : creation_date)
			});
		}
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async destroy(uuid: string, id: number) {
		let session = await this.tokenRepository
			.createQueryBuilder('token')
			.leftJoinAndSelect('token.user', 'user')
			.where({ id, user: uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose('No session found for ' + uuid + ' with id ' + id, e);
				throw new NotFoundException();
			});
		session.refresh_date = new Date(0);
		session.access_token_hash = '';
		session.refresh_token_hash = '';
		session.ua_hash = '';
		session.ip_hash = '';
		await this.tokenRepository.save(session).catch((e) => {
			this.logger.debug('Unable to destroy session ' + id, e);
			throw new InternalServerErrorException();
		});
		this.wsService.dispatch.user(uuid, {
			namespace: WsNamespace.User,
			action: UserAction.Refresh
		});
	}
}
