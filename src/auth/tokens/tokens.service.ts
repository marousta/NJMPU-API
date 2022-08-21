import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

import { UsersTokens } from './tokens.entity';
import { JwtPayload } from '../types';
import { UsersInfos } from '../../users/users.entity';

@Injectable()
export class TokensService extends TypeOrmCrudService<UsersTokens> {
	constructor(
		private configService: ConfigService,
		@InjectRepository(UsersTokens)
		private tokensRepository: Repository<UsersTokens>,
		private jwtService: JwtService
	) {
		super(tokensRepository);
	}

	private accessToken(payload: { id: number; uuid: string }): string {
		return this.jwtService.sign(payload, {
			algorithm: 'RS256',
			privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), { encoding: 'ascii' }),
			expiresIn: '10m'
		});
	}

	private refreshToken(id: number): string {
		return this.jwtService.sign(
			{ id },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), { encoding: 'ascii' }),
				expiresIn: '3d'
			}
		);
	}

	async update(id: number): Promise<{ access_token: string; refresh_token: string }> {
		try {
			const token = await this.tokensRepository
				.createQueryBuilder('token')
				.leftJoinAndSelect('token.player', 'users_infos')
				.whereInIds(id)
				.getOneOrFail();
			const user = token.player as unknown as UsersInfos;

			const access_token = this.accessToken({ id, uuid: user.uuid });
			const refresh_token = this.refreshToken(id);

			await this.tokensRepository.save({
				id: token.id,
				access_token_hash: await this.hash(access_token),
				refresh_token_hash: await this.hash(refresh_token)
			});
			return { access_token, refresh_token };
		} catch (e) {
			console.error(e);
			throw new UnauthorizedException();
		}
	}

	async delete(id: number) {
		try {
			await this.tokensRepository.save({
				id,
				access_token_hash: null,
				refresh_token_hash: null,
				ua_hash: null,
				ip_hash: null
			});
		} catch (e) {
			console.error(e);
			throw new BadRequestException();
		}
	}

	async validate(id: number, token: { access_token: string } | { refresh_token: string }, ua: string, ip: string) {
		const token_type = Object.keys(token)[0];

		let user_token: UsersTokens | null = null;
		try {
			user_token = await this.tokensRepository.findOne({ where: { id } });
		} catch (e) {
			console.error(e);
			throw new UnauthorizedException();
		}

		const token_verif = await argon2.verify(user_token[token_type + '_hash'], Object.values(token)[0]);
		const ua_verif = await argon2.verify(user_token.ua_hash, ua);
		const ip_verif = await argon2.verify(user_token.ip_hash, ip);

		if (!token_verif || !ua_verif || !ip_verif) {
			throw new UnauthorizedException();
		}
	}

	async hash(token: string): Promise<string> {
		return await argon2.hash(token, {
			timeCost: 11,
			saltLength: 128
		});
	}

	async create(payload: JwtPayload): Promise<{ access_token: string; refresh_token: string }> {
		const tokens = await this.tokensRepository.find({ order: { id: 'ASC' } });
		const id = tokens.length ? tokens[tokens.length - 1].id + 1 : 1;

		const access_token = this.accessToken({ id, uuid: payload.uuid });
		const refresh_token = this.refreshToken(id);

		const newTokens = this.tokensRepository.create({
			player: payload.uuid,
			creation_date: new Date(),
			platform: payload.platform,
			access_token_hash: await this.hash(access_token),
			refresh_token_hash: await this.hash(refresh_token),
			ua_hash: await this.hash(payload.ua),
			ip_hash: await this.hash(payload.ip)
		});

		try {
			await this.tokensRepository.save(newTokens);
		} catch (e) {
			console.error(e);
		}

		return { access_token, refresh_token };
	}
}
