import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import * as TwoFactor from 'node-2fa';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';

import { UsersTwofactorReq } from './2fa.entity';
import { UsersInfos } from '../../users/users.entity';

import { TwoFactorRequest } from '../types';

@Injectable()
export class TwoFactorService extends TypeOrmCrudService<UsersTwofactorReq> {
	constructor(
		@InjectRepository(UsersTwofactorReq) repo: Repository<UsersTwofactorReq>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private configService: ConfigService,
		private jwtService: JwtService
	) {
		super(repo);
	}

	private async request(uuid: string) {
		return await this.repo
			.createQueryBuilder('request')
			.leftJoinAndSelect('request.player', 'users_infos')
			.whereInIds(uuid)
			.getOneOrFail()
			.catch((e) => {
				console.error(e);
				throw new NotFoundException();
			});
	}

	async user(uuid: string) {
		const request = await this.request(uuid);
		return request.player as unknown as UsersInfos;
	}

	twoFactorToken(uuid: string): string {
		return this.jwtService.sign(
			{ uuid },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'ascii'
				}),
				expiresIn: '4m'
			}
		);
	}

	private async requestCreator(uuid: string, secret?: string): Promise<TwoFactorRequest> {
		const new_request = this.repo.create({
			player: uuid,
			secret
		});
		const request = await this.repo.save(new_request).catch((e) => {
			console.error(e);
			throw new InternalServerErrorException();
		});
		const token = this.twoFactorToken(request.uuid);
		await this.repo
			.save({
				...request,
				token: await argon2.hash(token, {
					timeCost: 11,
					saltLength: 128
				})
			})
			.catch((e) => {
				console.error(e);
				throw new InternalServerErrorException();
			});
		return { interface: 'TwoFactorRequest', uuid: request.uuid, token };
	}

	private async create(user: UsersInfos): Promise<TwoFactorRequest> {
		const token = TwoFactor.generateSecret({
			name: 'NEW SHINJI MEGA PONG ULTIMATE',
			account: user.email
		});

		const qr = await QRCode.toDataURL(token.uri);

		const request = await this.requestCreator(user.uuid, token.secret);
		return { ...request, image: qr };
	}

	async delete(uuid: string) {
		await this.repo.delete({ uuid }).catch((e) => {
			console.error(e);
			throw new InternalServerErrorException();
		});
	}

	async demand(user: UsersInfos): Promise<TwoFactorRequest> {
		if (user.twofactor) {
			const request = await this.requestCreator(user.uuid);
			return { ...request, image: null };
		} else {
			return await this.create(user);
		}
	}

	public readonly verify = {
		token: async (payload: { uuid: string; token: string }) => {
			const request = await this.repo.findOneByOrFail({ uuid: payload.uuid }).catch((e) => {
				console.error(e);
				throw new UnauthorizedException();
			});

			return await argon2.verify(request.token_hash, payload.token);
		},
		code: async (request_uuid: string, code: string): Promise<boolean> => {
			const request = await this.request(request_uuid);
			const user = request.player as unknown as UsersInfos;

			if (!user.twofactor) {
				if (TwoFactor.verifyToken(request.secret, code, 2) !== null) {
					const update = this.usersRepository.create({
						...user,
						twofactor: request.secret
					});
					await this.usersRepository.save(update).catch((e) => {
						console.error(e);
						throw new InternalServerErrorException();
					});
					return true;
				} else {
					return false;
				}
			} else {
				if (TwoFactor.verifyToken(user.twofactor, code, 2) !== null) {
					return true;
				} else {
					return false;
				}
			}
		}
	};
}
