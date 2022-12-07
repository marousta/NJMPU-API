import {
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
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
		private readonly wsService: WsService,
	) {}

	/**
	 * Utils
	 */
	//#region

	private isActive(date: Date) {
		const offset = 60 * 60 * 24 * 3 * 1000; //3d
		return date.valueOf() + offset > new Date().valueOf();
	}
	//#endregion

	/**
	 * Service
	 */
	//#region

	async get(
		tuuid: string,
		uuid: string,
		page: number = 1,
		limit: number = 0,
		offset: number = 0,
	): Promise<SessionsGetResponse> {
		if (page === 0) {
			page = 1;
		}

		const ret = await this.tokenRepository
			.createQueryBuilder('token')
			.select(['token.uuid', 'token.platform', 'token.creation_date', 'token.refresh_date'])
			.where({ user_uuid: uuid })
			.orderBy('refresh_date', 'DESC')
			.addOrderBy('creation_date', 'DESC')
			.limit(limit)
			.offset((page ? page - 1 : 0) * limit + offset)
			.getManyAndCount();

		let data: SessionData[] = ret[0].map((token) => {
			const ret = {
				uuid: token.uuid,
				platform: token.platform,
				creation_date: token.creation_date,
				active: this.isActive(
					token.refresh_date ? token.refresh_date : token.creation_date,
				),
				current: false,
			};
			if (token.uuid === tuuid) {
				ret.current = true;
			}
			return ret;
		});
		const count = ret[0].length;
		const total = ret[1];
		const page_count = limit ? Math.ceil(total / limit) : 1;
		return { data, count, total, page, page_count };
	}

	async destroy(tuuid: string, uuuid: string) {
		let session = await this.tokenRepository
			.createQueryBuilder('token')
			.where({ uuid: tuuid, user_uuid: uuuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose('No session found for ' + uuuid + ' with id ' + tuuid, e);
				throw new NotFoundException(ApiResponseError.InvalidSession);
			});

		session.refresh_date = new Date(0);
		session.access_token_hash = '';
		session.refresh_token_hash = '';
		session.ua_hash = '';
		session.ip_hash = '';

		await this.tokenRepository.save(session).catch((e) => {
			this.logger.debug('Unable to destroy session ' + tuuid, e);
			throw new UnprocessableEntityException();
		});

		this.wsService.dispatch.user(uuuid, {
			namespace: WsNamespace.User,
			action: UserAction.Refresh,
		});
	}
	//#endregion
}
