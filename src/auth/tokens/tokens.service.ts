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

import { UsersTokens, UsersTokensID } from './tokens.entity';
import { UsersInfos } from '../../users/users.entity';

import { hash_token_config } from '../config';
import { GeneratedTokens, JwtPayload, PartialUsersInfos } from '../types';
import { isEmpty } from '../../utils';
import { hash, hash_verify } from '../utils';

@Injectable()
export class TokensService {
	private readonly logger = new Logger(TokensService.name);
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(UsersTokens)
		private readonly tokensRepository: Repository<UsersTokens>,
		private readonly jwtService: JwtService
	) {}

	private accessToken(payload: { id: number; uuid: string }): string {
		return this.jwtService.sign(payload, {
			algorithm: 'RS256',
			privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
				encoding: 'ascii'
			}),
			expiresIn: '20m'
		});
	}

	private refreshToken(id: number): string {
		return this.jwtService.sign(
			{ id },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'ascii'
				}),
				expiresIn: '3d'
			}
		);
	}

	private async getUser(id: number): Promise<UsersInfos> {
		const token: UsersTokensID = await this.tokensRepository
			.createQueryBuilder('token')
			.leftJoinAndSelect('token.user', 'user')
			.whereInIds(id)
			.getOneOrFail()
			.catch((e) => {
				console.log(id);
				this.logger.error('Failed to fetch token', e);
				throw new UnauthorizedException();
			});
		return token.user;
	}

	async update(id: number): Promise<GeneratedTokens> {
		const user = await this.getUser(id);

		const access_token = this.accessToken({ id, uuid: user.uuid });
		const refresh_token = this.refreshToken(id);

		const hashs = await Promise.all([
			hash(access_token, hash_token_config),
			hash(refresh_token, hash_token_config)
		]);

		await this.tokensRepository
			.save({
				id,
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

	async delete(id: number) {
		await this.tokensRepository
			.save({
				id,
				access_token_hash: null,
				refresh_token_hash: null,
				ua_hash: null,
				ip_hash: null
			})
			.catch((e) => {
				this.logger.error('Failed to delete token', e);
				throw new BadRequestException();
			});
		this.logger.debug('Token destroyed ' + id);
	}

	async validate(
		id: number,
		token: { access_token: string } | { refresh_token: string },
		ua: string,
		ip: string
	) {
		const token_type = Object.keys(token)[0];

		const user_token = await this.tokensRepository.findOneByOrFail({ id }).catch((e) => {
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
	}

	async create(payload: JwtPayload): Promise<GeneratedTokens> {
		const tokens = await this.tokensRepository.find({ order: { id: 'ASC' } });
		const id = tokens.length ? tokens[tokens.length - 1].id + 1 : 1;

		const access_token = this.accessToken({ id, uuid: payload.uuid });
		const refresh_token = this.refreshToken(id);

		const hashs = await Promise.all([
			hash(access_token, hash_token_config),
			hash(refresh_token, hash_token_config),
			hash(payload.fingerprint.ua, hash_token_config),
			hash(payload.fingerprint.ip, hash_token_config)
		]);

		const new_tokens = this.tokensRepository.create({
			id: id,
			user_uuid: payload.uuid,
			creation_date: new Date(),
			platform: payload.fingerprint.platform,
			access_token_hash: hashs[0],
			refresh_token_hash: hashs[1],
			ua_hash: hashs[2],
			ip_hash: hashs[3]
		});

		await this.tokensRepository.save(new_tokens).catch((e) => {
			this.logger.error('Failed to insert token', e);
			throw new InternalServerErrorException();
		});

		this.logger.debug('User as sign in ' + payload.uuid);
		return { interface: 'GeneratedTokens', access_token, refresh_token };
	}
}
