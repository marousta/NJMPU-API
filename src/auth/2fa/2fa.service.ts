import {
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import * as TwoFactor from 'node-2fa';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';

import { UsersTwofactorReq } from './2fa.entity';
import { UsersInfos } from '../../users/users.entity';

import { TwoFactorRequest } from '../types';
import { hash, hash_verify } from '../utils';
import { hash_token_config } from '../config';

@Injectable()
export class TwoFactorService {
	private readonly logger = new Logger(TwoFactorService.name);
	constructor(
		@InjectRepository(UsersTwofactorReq)
		private readonly twofactorRepository: Repository<UsersTwofactorReq>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService
	) {}

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

	private async request(uuid: string) {
		return await this.twofactorRepository
			.createQueryBuilder('request')
			.leftJoinAndSelect('request.player', 'users_infos')
			.where({ uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose("2FA request doesn't exist " + uuid);
				throw new NotFoundException();
			});
	}

	async user(uuid: string) {
		const request = await this.request(uuid);
		return request.player as unknown as UsersInfos;
	}

	private async saveToken(request: UsersTwofactorReq): Promise<string> {
		const token = this.twoFactorToken(request.uuid);
		await this.twofactorRepository
			.save({
				...request,
				token_hash: await hash(token, hash_token_config)
			})
			.catch((e) => {
				this.logger.error('Could not insert token', e.detail);
				throw new InternalServerErrorException();
			});
		return token;
	}

	private async requestCreator(uuid: string, secret?: string): Promise<TwoFactorRequest> {
		const exist = await this.twofactorRepository
			.createQueryBuilder('request')
			.leftJoinAndSelect('request.player', 'users_infos')
			.where({ player: uuid })
			.getMany()
			.catch((e) => {
				this.logger.error('Could not fetch existing request ' + uuid, e.detail);
				throw new InternalServerErrorException();
			});

		if (exist) {
			let requests = [];
			for (const request of exist) {
				requests.push(
					this.twofactorRepository.delete(request).then(() => {
						this.logger.debug('Deleted 2FA request ' + request.uuid);
					})
				);
			}
			await Promise.all(requests);
		}

		const new_request = this.twofactorRepository.create({
			player: uuid,
			secret
		});

		const request = await this.twofactorRepository.save(new_request).catch((e) => {
			this.logger.error('Could not insert request', e.detail);
			throw new InternalServerErrorException();
		});
		const token = await this.saveToken(request);

		return { interface: 'TwoFactorRequest', uuid: request.uuid, token };
	}

	private async create(user: UsersInfos): Promise<TwoFactorRequest> {
		const token = TwoFactor.generateSecret({
			name: 'NEW SHINJI MEGA PONG ULTIMATE',
			account: user.email
		});

		const requests = await Promise.all([
			QRCode.toDataURL(token.uri),
			this.requestCreator(user.uuid, token.secret)
		]);

		const qr = requests[0];
		const request = requests[1];

		this.logger.debug('Created 2FA request ' + request.uuid);

		return { ...request, image: qr };
	}

	async delete(uuid: string) {
		await this.twofactorRepository.delete({ uuid }).catch((e) => {
			this.logger.error('Could not delete request  ' + uuid, e.detail);
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
			const request = await this.twofactorRepository
				.findOneByOrFail({ uuid: payload.uuid })
				.catch((e) => {
					this.logger.verbose('Request not found ' + payload.uuid);
					throw new UnauthorizedException();
				});

			return await hash_verify(request.token_hash, payload.token);
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
						this.logger.error(
							'Could not update secret token for user ' + update.uuid,
							e
						);
						throw new InternalServerErrorException();
					});
					this.logger.debug('2FA set for user ' + user.uuid);
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
