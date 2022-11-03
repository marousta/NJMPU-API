import {
	Injectable,
	UnauthorizedException,
	BadRequestException,
	InternalServerErrorException,
	Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { UsersService } from '../../users/services/users.service';
import { WsService } from '../../websockets/ws.service';

import { UsersTokens, UsersTokensID } from './tokens.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { hash_token_config } from '../config';

import { isEmpty } from '../../utils';
import { hash, hash_verify } from '../utils';

import { GeneratedTokens, JwtPayload } from '../types';
import { UserAction, WsNamespace } from '../../websockets/types';

@Injectable()
export class TokensService {
	private readonly logger = new Logger(TokensService.name);
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(UsersTokens)
		private readonly tokensRepository: Repository<UsersTokens>,
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly wsService: WsService
	) {}

	private accessToken(tuuid: string, uuuid: string): string {
		return this.jwtService.sign(
			{ tuuid, uuuid },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'utf8'
				}),
				expiresIn: '20m'
			}
		);
	}

	private refreshToken(tuuid: string): string {
		return this.jwtService.sign(
			{ tuuid },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'utf8'
				}),
				expiresIn: '3d'
			}
		);
	}

	async getUser(uuid: string): Promise<UsersInfos> {
		const token: UsersTokensID = await this.tokensRepository
			.createQueryBuilder('token')
			.where({ uuid })
			.loadAllRelationIds()
			.getOneOrFail()
			.catch((e) => {
				console.log(uuid);
				this.logger.error('Failed to fetch token', e);
				throw new UnauthorizedException();
			});
		const user = await this.usersService.findWithRelationsOrNull(
			{ uuid: token.user_uuid },
			'Failed to find related user ' + token.user_uuid + ' for token ' + uuid
		);
		if (!user) {
			throw new InternalServerErrorException();
		}
		return user;
	}

	async update(uuid: string): Promise<GeneratedTokens> {
		const user = await this.getUser(uuid);

		const access_token = this.accessToken(uuid, user.uuid);
		const refresh_token = this.refreshToken(uuid);

		const hashs = await Promise.all([
			hash(access_token, hash_token_config),
			hash(refresh_token, hash_token_config)
		]);

		await this.tokensRepository
			.save({
				uuid,
				refresh_date: new Date(),
				access_token_hash: hashs[0],
				refresh_token_hash: hashs[1]
			})
			.catch((e) => {
				this.logger.error('Unable to update token', e);
				throw new UnauthorizedException();
			});

		this.logger.debug('Token refreshed for user ' + user.uuid);
		return { interface: 'GeneratedTokens', access_token, refresh_token };
	}

	async delete(uuid: string) {
		await this.tokensRepository
			.save({
				uuid,
				access_token_hash: null,
				refresh_token_hash: null,
				ua_hash: null,
				ip_hash: null
			})
			.catch((e) => {
				this.logger.error('Failed to delete token', e);
				throw new BadRequestException();
			});

		this.logger.debug('Token destroyed ' + uuid);
	}

	async validate(
		uuid: string,
		token: { access_token: string } | { refresh_token: string },
		ua: string,
		ip: string
	) {
		const token_type = Object.keys(token)[0];

		const user_token = await this.tokensRepository.findOneByOrFail({ uuid }).catch((e) => {
			this.logger.verbose('Token not found', e);
			throw new UnauthorizedException();
		});

		if (
			isEmpty(user_token[token_type + '_hash']) ||
			isEmpty(user_token.ua_hash) ||
			isEmpty(user_token.ip_hash)
		) {
			this.logger.verbose('Token is destroyed');
			throw new UnauthorizedException();
		}

		const hashs_verif = await Promise.all([
			hash_verify(user_token[token_type + '_hash'], Object.values(token)[0]),
			hash_verify(user_token.ua_hash, ua),
			hash_verify(user_token.ip_hash, ip)
		]);

		if (!hashs_verif[0] || !hashs_verif[1] || !hashs_verif[2]) {
			this.logger.verbose('Token is not trusted');
			throw new UnauthorizedException();
		}

		return this.getUser(uuid);
	}

	async create(payload: JwtPayload): Promise<GeneratedTokens> {
		const tuuid = randomUUID();

		const access_token = this.accessToken(tuuid, payload.uuid);
		const refresh_token = this.refreshToken(tuuid);

		const hashs = await Promise.all([
			hash(access_token, hash_token_config),
			hash(refresh_token, hash_token_config),
			hash(payload.fingerprint.ua, hash_token_config),
			hash(payload.fingerprint.ip, hash_token_config)
		]);

		const date = new Date();
		const new_tokens = this.tokensRepository.create({
			uuid: tuuid,
			user_uuid: payload.uuid,
			creation_date: date,
			platform: payload.fingerprint.platform,
			access_token_hash: hashs[0],
			refresh_token_hash: hashs[1],
			ua_hash: hashs[2],
			ip_hash: hashs[3]
		});

		await this.tokensRepository.save(new_tokens).catch(async (e) => {
			this.logger.error('Failed to insert token', e);
			// fallback
			new_tokens.uuid = randomUUID();
			return await this.tokensRepository.save(new_tokens).catch((e) => {
				throw new InternalServerErrorException();
			});
		});

		this.logger.debug('User as sign in ' + payload.uuid);
		this.wsService.dispatch.user(payload.uuid, {
			namespace: WsNamespace.User,
			action: UserAction.Session,
			uuid: tuuid,
			platform: payload.fingerprint.platform,
			creation_date: date,
			active: true
		});

		return { interface: 'GeneratedTokens', access_token, refresh_token };
	}
}
