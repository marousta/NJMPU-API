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

import { UsersTwofactorReq, UsersTwofactorReqID } from './2fa.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { hash_token_config } from '../config';

import { hash, hash_verify } from '../utils';
import { dateFromOffset } from '../../utils';

import { TwoFactorRequest } from '../types';

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

	/**
	 * Utils
	 */
	private twoFactorToken(uuid: string): string {
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

	private async saveToken(request: UsersTwofactorReq): Promise<string> {
		const token = this.twoFactorToken(request.uuid);
		await this.twofactorRepository
			.save({
				...request,
				token_hash: await hash(token, hash_token_config)
			})
			.catch((e) => {
				this.logger.error('Could not insert token', e);
				throw new InternalServerErrorException();
			});
		return token;
	}

	private async request(uuid: string): Promise<UsersTwofactorReqID> {
		return await this.twofactorRepository
			.createQueryBuilder('request')
			.leftJoinAndMapOne(
				'request.user',
				UsersInfos,
				'users_infos',
				'users_infos.uuid = request.user_uuid'
			)
			.where({ uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose("2FA request doesn't exist " + uuid, e);
				throw new NotFoundException();
			});
	}

	async user(uuid: string) {
		const request = await this.request(uuid);
		return request.user;
	}

	// Remove expired requests
	private async garbageCollect() {
		const exist = await this.twofactorRepository.find().catch((e) => {
			this.logger.error('Could not fetch existing requests', e);
			throw new InternalServerErrorException();
		});

		if (exist) {
			let requests = [];
			const now = new Date().valueOf();

			for (const request of exist) {
				console.log(request.expiration.valueOf(), now);
				if (request.expiration.valueOf() > now) {
					continue;
				}
				requests.push(
					this.twofactorRepository
						.delete(request)
						.then(() => {
							this.logger.debug('Deleted 2FA request ' + request.uuid);
						})
						.catch((e) => {
							this.logger.error('Unable to delete 2FA request ' + request.uuid);
						})
				);
			}

			await Promise.all(requests);
		}
	}

	/**
	 * Service
	 */
	private async requestCreator(uuid: string, secret?: string): Promise<TwoFactorRequest> {
		await this.garbageCollect();

		const new_request = this.twofactorRepository.create({
			user_uuid: uuid,
			secret, // undefined for login reauest
			expiration: dateFromOffset(60 * 4)
		});
		const request = await this.twofactorRepository.save(new_request).catch((e) => {
			this.logger.error('Could not insert request', e);
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
			this.logger.error('Could not delete request  ' + uuid, e);
			throw new InternalServerErrorException();
		});
	}

	async demand(user: UsersInfos): Promise<TwoFactorRequest> {
		if (user.twofactor) {
			// Create 2FA login request
			const request = await this.requestCreator(user.uuid);
			return { ...request, image: null };
		}
		// Create 2FA setup request
		return await this.create(user);
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
			const user = request.user;

			if (!user.twofactor && TwoFactor.verifyToken(request.secret, code, 2) !== null) {
				const update = this.usersRepository.create({
					...user,
					twofactor: request.secret
				});
				await this.usersRepository.save(update).catch((e) => {
					this.logger.error('Could not update secret token for user ' + update.uuid, e);
					throw new InternalServerErrorException();
				});
				this.logger.debug('2FA set for user ' + user.uuid);
				return true;
			} else if (TwoFactor.verifyToken(user.twofactor, code, 2) !== null) {
				return true;
			}
			return false;
		}
	};
}
