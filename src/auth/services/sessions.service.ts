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

import { SessionData, SessionsGetResponse } from '../properties/sessions.property';

import { UserAction, WsNamespace } from '../../websockets/types';
import { ApiResponseError } from '../types';

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
		tid: number,
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
			.select(['token.id', 'token.platform', 'token.creation_date', 'token.refresh_date'])
			.where({ user_uuid: uuid })
			.orderBy('refresh_date', 'DESC')
			.addOrderBy('creation_date', 'DESC')
			.addOrderBy('id', 'DESC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.getManyAndCount();

		let data: SessionData[] = ret[0].map((token) => {
			const ret = {
				id: token.id,
				platform: token.platform,
				creation_date: token.creation_date,
				active: this.isActive(
					token.refresh_date ? token.refresh_date : token.creation_date
				),
				current: false
			};
			if (token.id === tid) {
				ret.current = true;
			}
			return ret;
		});
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async destroy(uuid: string, id: number) {
		let session = await this.tokenRepository
			.createQueryBuilder('token')
			.where({ id, user_uuid: uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose('No session found for ' + uuid + ' with id ' + id, e);
				throw new NotFoundException(ApiResponseError.InvalidSession);
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
