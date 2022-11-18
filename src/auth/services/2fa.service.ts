import {
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	UnauthorizedException,
	ForbiddenException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import * as TwoFactor from 'node-2fa';
import * as QRCode from 'qrcode';

import { UsersService } from '../../users/services/users.service';

import { UsersTwofactorReq, UsersTwofactorReqID } from '../entities/2fa.entity';
import { UsersInfos } from '../../users/entities/users.entity';

import { hash_token_config } from '../config';

import { hash, hash_verify } from '../utils';
import { dateFromOffset } from '../../utils';

import { ApiResponseError, TwoFactorRequest, TwoFactorSetupRequest } from '../types';

@Injectable()
export class TwoFactorService {
	private readonly logger = new Logger(TwoFactorService.name);
	constructor(
		@InjectRepository(UsersTwofactorReq)
		private readonly twofactorRepository: Repository<UsersTwofactorReq>,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly usersService: UsersService,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService
	) {}

	/**
	 * Utils
	 */
	//#region

	private twoFactorToken(uuid: string): string {
		return this.jwtService.sign(
			{ uuid },
			{
				algorithm: 'RS256',
				privateKey: readFileSync(this.configService.get<string>('JWT_PRIVATE'), {
					encoding: 'utf8'
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

	private async getRequest(uuid: string): Promise<UsersTwofactorReqID> {
		return await this.twofactorRepository
			.createQueryBuilder('request')
			.loadAllRelationIds()
			.where({ uuid })
			.getOneOrFail()
			.catch((e) => {
				this.logger.verbose("2FA request doesn't exist " + uuid, e);
				throw new NotFoundException(ApiResponseError.TwoFactorInvalidRequest);
			});
	}

	async getUserFromRequest(uuid: string) {
		const request = await this.getRequest(uuid);
		const user = await this.usersService.findWithRelationsOrNull(
			{ uuid: request.user_uuid },
			'Unable to find user ' + request.user_uuid + ' from 2FA request ' + uuid
		);
		if (!user) {
			throw new InternalServerErrorException();
		}

		return user;
	}

	// Remove expired requests
	private async garbageCollect() {
		const exist = await this.twofactorRepository.find().catch((e) => {
			this.logger.error('Could not fetch existing requests', e);
			return null;
		});

		if (exist) {
			let requests = [];
			const now = new Date().valueOf();

			for (const request of exist) {
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
	//#endregion

	/**
	 * Service
	 */
	//#region

	private async requestCreator(uuid: string, secret?: string): Promise<TwoFactorRequest> {
		await this.garbageCollect();

		const new_request = this.twofactorRepository.create({
			user_uuid: uuid,
			secret, // undefined for login request
			expiration: dateFromOffset(60 * 4)
		});
		const request = await this.twofactorRepository.save(new_request).catch((e) => {
			this.logger.error('Could not insert request', e);
			throw new InternalServerErrorException();
		});
		const token = await this.saveToken(request);

		return { interface: 'TwoFactorRequest', uuid: request.uuid, token };
	}

	private async create(user: UsersInfos): Promise<TwoFactorSetupRequest> {
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

		return {
			...request,
			image: qr,
			text: token.secret
		};
	}

	async delete(uuid: string) {
		await this.twofactorRepository.delete({ uuid }).catch((e) => {
			this.logger.error('Could not delete request  ' + uuid, e);
			throw new InternalServerErrorException();
		});
	}

	async remove(user: UsersInfos) {
		if (!user.twofactor) {
			throw new ForbiddenException(ApiResponseError.TwoFactorNotSet);
		}

		user.twofactor = null;

		await this.usersRepository.save(user).catch((e) => {
			this.logger.error('Unable to remove 2FA from user account ' + user.uuid, e);
			throw new InternalServerErrorException();
		});
	}

	async demand(user: UsersInfos): Promise<TwoFactorSetupRequest | TwoFactorRequest> {
		if (user.twofactor) {
			// Create 2FA login request
			return await this.requestCreator(user.uuid);
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

			const verif = await hash_verify(request.token_hash, payload.token);
			if (!verif) {
				return false;
			}

			return await this.getUserFromRequest(payload.uuid);
		},
		code: async (user: UsersInfos, request_uuid: string, code: string): Promise<boolean> => {
			const request = await this.getRequest(request_uuid);

			if (request.user_uuid !== user.uuid) {
				throw new InternalServerErrorException();
			}

			// 2FA set
			if (user.twofactor) {
				return TwoFactor.verifyToken(user.twofactor, code, 2) !== null;
			}

			// 2FA setup
			if (TwoFactor.verifyToken(request.secret, code, 2) !== null) {
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
			}
			return false;
		}
	};
	//#endregion
}
