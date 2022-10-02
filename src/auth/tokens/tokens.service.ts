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
import * as argon2 from 'argon2';
import { readFileSync } from 'fs';

import { UsersTokens } from './tokens.entity';
import { UsersInfos } from '../../users/users.entity';

import { GeneratedTokens, JwtPayload, PartialUsersInfos } from '../types';
import { isEmpty } from '../../utils';

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
			expiresIn: '10m'
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
		const token = await this.tokensRepository
			.createQueryBuilder('token')
			.leftJoinAndSelect('token.user', 'users_infos')
			.whereInIds(id)
			.getOneOrFail()
			.catch((e) => {
				this.logger.error('Failed to fetch token', e);
				throw new UnauthorizedException();
			});
		const user = token.user as unknown as UsersInfos;
		return user;
	}

	async update(id: number): Promise<GeneratedTokens> {
		const user = await this.getUser(id);

		const access_token = this.accessToken({ id, uuid: user.uuid });
		const refresh_token = this.refreshToken(id);

		await this.tokensRepository
			.save({
				id,
				refresh_date: new Date(),
				access_token_hash: await this.hash(access_token),
				refresh_token_hash: await this.hash(refresh_token)
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
			throw new UnauthorizedException();
		}

		const token_verif = await argon2.verify(
			user_token[token_type + '_hash'],
			Object.values(token)[0]
		);
		const ua_verif = await argon2.verify(user_token.ua_hash, ua);
		const ip_verif = await argon2.verify(user_token.ip_hash, ip);

		if (!token_verif || !ua_verif || !ip_verif) {
			this.logger.verbose('Token is not trusted');
			throw new UnauthorizedException();
		}
	}

	async hash(token: string): Promise<string> {
		return await argon2.hash(token, {
			timeCost: 11,
			saltLength: 128
		});
	}

	async create(payload: JwtPayload): Promise<GeneratedTokens> {
		const tokens = await this.tokensRepository.find({ order: { id: 'ASC' } });
		const id = tokens.length ? tokens[tokens.length - 1].id + 1 : 1;

		const access_token = this.accessToken({ id, uuid: payload.uuid });
		const refresh_token = this.refreshToken(id);

		const new_tokens = this.tokensRepository.create({
			id: id,
			user: payload.uuid,
			creation_date: new Date(),
			platform: payload.fingerprint.platform,
			access_token_hash: await this.hash(access_token),
			refresh_token_hash: await this.hash(refresh_token),
			ua_hash: await this.hash(payload.fingerprint.ua),
			ip_hash: await this.hash(payload.fingerprint.ip)
		});

		await this.tokensRepository.save(new_tokens).catch((e) => {
			this.logger.error('Failed to insert token', e);
			throw new InternalServerErrorException();
		});

		this.logger.debug('User as sign in ' + payload.uuid);
		return { interface: 'GeneratedTokens', access_token, refresh_token };
	}

	async user(id: number): Promise<PartialUsersInfos> {
		const user = await this.getUser(id);
		return {
			uuid: user.uuid,
			identifier: user.identifier,
			username: user.username,
			email: user.email,
			twofactor: user.twofactor !== null,
			avatar: user.avatar
		};
	}
}
