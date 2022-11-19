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

import { UsersTwofactorReq } from '../entities/2fa';
import { UsersInfos } from '../../users/entities/users.entity';

import { hash_token_config } from '../config';

import { hash, hash_verify } from '../utils';

import { ApiResponseError, TwoFactorRequest, TwoFactorSetupRequest } from '../types';

@Injectable()
export class TwoFactorService {
	private readonly logger = new Logger(TwoFactorService.name);
	private twofactor: { [uuid: string]: UsersTwofactorReq } = {};
	constructor(
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
			{ tuuid: uuid },
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
		request.token_hash = await hash(token, hash_token_config);
		this.twofactor[request.uuid] = request;
		return token;
	}

	private getRequest(request_uuid: string): UsersTwofactorReq {
		const request = this.twofactor[request_uuid];
		if (!request) {
			this.logger.verbose("2FA request doesn't exist " + request_uuid);
			throw new NotFoundException(ApiResponseError.TwoFactorInvalidRequest);
		}
		return request;
	}

	getUserFromRequest(request_uuid: string): UsersInfos {
		const request = this.getRequest(request_uuid);
		if (!request.user) {
			throw new InternalServerErrorException();
		}

		return request.user;
	}

	// Remove expired requests
	private garbageCollect() {
		const exist = Object.values(this.twofactor);

		if (exist.length > 0) {
			const now = new Date().valueOf();

			for (const request of exist) {
				if (request.expiration.valueOf() > now) {
					continue;
				}
				this.delete(request.uuid);
				this.logger.debug('Deleted 2FA request ' + request.uuid);
			}
		}
	}
	//#endregion

	/**
	 * Service
	 */
	//#region

	private async requestCreator(
		current_user_uuid: string,
		secret?: string
	): Promise<TwoFactorRequest> {
		this.garbageCollect();

		const user = await this.usersService.findWithRelationsOrNull(
			{ uuid: current_user_uuid },
			'Unable to find user ' + current_user_uuid + ' from 2FA request ' + current_user_uuid
		);

		const request = new UsersTwofactorReq({
			user,
			secret // undefined for login request
		});
		const token = await this.saveToken(request);

		return { interface: 'TwoFactorRequest', tuuid: request.uuid, token };
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

		this.logger.debug('Created 2FA request ' + request.tuuid);

		return {
			...request,
			image: qr,
			text: token.secret
		};
	}

	delete(uuid: string) {
		delete this.twofactor[uuid];
	}

	async remove(current_user: UsersInfos) {
		if (!current_user.twofactor) {
			throw new ForbiddenException(ApiResponseError.TwoFactorNotSet);
		}

		current_user.twofactor = null;

		await this.usersRepository.save(current_user).catch((e) => {
			this.logger.error('Unable to remove 2FA from user account ' + current_user.uuid, e);
			throw new InternalServerErrorException();
		});
		this.logger.verbose('Removed 2FA for user ' + current_user.uuid);
	}

	async demand(current_user: UsersInfos): Promise<TwoFactorSetupRequest | TwoFactorRequest> {
		if (current_user.twofactor) {
			// Create 2FA login request
			return await this.requestCreator(current_user.uuid);
		}
		// Create 2FA setup request
		return await this.create(current_user);
	}

	public readonly verify = {
		token: async (payload: { uuid: string; token: string }): Promise<UsersInfos> => {
			const request = this.getRequest(payload.uuid);

			const verif = await hash_verify(request.token_hash, payload.token);
			if (!verif) {
				return null;
			}

			return this.getUserFromRequest(payload.uuid);
		},
		code: async (
			current_user: UsersInfos,
			request_uuid: string,
			code: string
		): Promise<boolean> => {
			const request = this.getRequest(request_uuid);
			const user = request.user;

			if (user.uuid !== current_user.uuid) {
				throw new InternalServerErrorException();
			}

			// 2FA set
			if (user.twofactor) {
				const verify = TwoFactor.verifyToken(user.twofactor, code, 2) !== null;
				if (verify) {
					this.logger.debug('2FA request is valid ' + request_uuid);
					this.delete(request.uuid);
				}

				return verify;
			}

			// 2FA setup
			if (TwoFactor.verifyToken(request.secret, code, 2) !== null) {
				user.twofactor = request.secret;

				await this.usersRepository.save(user).catch((e) => {
					this.logger.error('Could not update secret token for user ' + user.uuid, e);
					throw new InternalServerErrorException();
				});

				this.logger.debug('2FA set for user ' + user.uuid);

				this.delete(request.uuid);
				return true;
			}
			return false;
		}
	};
	//#endregion
}
