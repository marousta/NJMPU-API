import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Request, Response } from 'express';

import { UsersService } from '../../users/services/users.service';
import { TokensService } from '../tokens/tokens.service';
import { PicturesService } from '../../pictures/pictures.service';
import { TwoFactorService } from '../services/2fa.service';
import { WsService } from '../../websockets/ws.service';

import { SignupProperty } from '../properties/signup.property';

import { UsersInfos } from '../../users/entities/users.entity';

import { getPartialUser, isEmpty, getFingerprint } from '../../utils';
import { hash_verify } from '../utils';

import {
	DiscordUser,
	GeneratedTokens,
	Intra42User,
	UserFingerprint,
	TwoFactorRequest,
	ApiResponseError,
	TwoFactorSetupRequest
} from '../types';
import { UserAction, WsNamespace } from '../../websockets/types';
import { JwtData, TwitterUser } from '../types';

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	constructor(
		private readonly configService: ConfigService,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly usersService: UsersService,
		private readonly tokensService: TokensService,
		private readonly twoFactorService: TwoFactorService,
		private readonly wsService: WsService
	) {}

	async validate(email: string, password: string): Promise<UsersInfos> {
		const user = await this.usersRepository.findOneByOrFail({ email }).catch((e) => {
			this.logger.verbose('No user with email ' + email);
			throw new UnauthorizedException();
		});

		const verif = await hash_verify(user.password, password);
		if (!verif) {
			this.logger.verbose('Failed to verify password');
			throw new UnauthorizedException();
		}
		return user;
	}

	public readonly login = {
		byPassword: async (
			user: UsersInfos,
			fingerprint: UserFingerprint
		): Promise<GeneratedTokens | TwoFactorSetupRequest | TwoFactorRequest> => {
			if (user.twofactor) {
				return await this.twoFactorService.demand(user);
			}

			return await this.tokensService.create({
				uuid: user.uuid,
				fingerprint
			});
		},
		byAPI: async (
			user: Intra42User | DiscordUser | TwitterUser,
			fingerprint: UserFingerprint
		): Promise<GeneratedTokens | TwoFactorSetupRequest | TwoFactorRequest> => {
			const parital_user = getPartialUser(user);

			const exist = await this.usersRepository
				.findOneByOrFail({ email: parital_user.email })
				.catch((e) => {
					this.logger.verbose('No user with email ' + parital_user.email);
					return null;
				});

			if (!exist) {
				return null;
			}

			if (exist.twofactor) {
				return await this.twoFactorService.demand(exist);
			}

			return await this.tokensService.create({
				uuid: exist.uuid,
				fingerprint
			});
		}
	};

	public readonly cookie = {
		create: (
			res: Response,
			obj: { access_token: string } | { refresh_token: string } | { twofactor_token: string }
		) => {
			const name = Object.keys(obj)[0];

			let expires = new Date();

			if (name === 'access_token') {
				expires = new Date(expires.valueOf() + 60 * 10 * 2000); // 20m
			} else if (name === 'refresh_token') {
				expires = new Date(expires.valueOf() + 60 * 60 * 24 * 3 * 1000); //3d
			} else if (name === 'twofactor_token') {
				expires = new Date(expires.valueOf() + 60 * 4 * 1000); // 4m
			}

			res.cookie(name, Object.values(obj)[0], {
				domain: this.configService.get<string>('DOMAIN'),
				sameSite: 'strict',
				httpOnly: true,
				expires
			});
		},
		delete: (res: Response, name: string) => {
			res.cookie(name, '', {
				domain: this.configService.get<string>('DOMAIN'),
				sameSite: 'strict',
				httpOnly: true,
				expires: new Date()
			});
		}
	};

	public readonly user = {
		create: async (params: SignupProperty) => {
			if (
				isEmpty(params.username) ||
				isEmpty(params.password) ||
				isEmpty(params.confirm) ||
				isEmpty(params.email)
			) {
				throw new BadRequestException(ApiResponseError.EmptyFields);
			}

			if (params.password !== params.confirm) {
				throw new BadRequestException(ApiResponseError.PasswordMismatch);
			}

			await this.usersService.create(params);
		},
		disconnect: async (payload: JwtData) => {
			const user = await this.tokensService.getUser(payload.token.tuuid).catch((e) => null);
			if (!user) {
				return;
			}

			await this.tokensService.delete(payload.token.tuuid);

			this.wsService.dispatch.user(user.uuid, {
				namespace: WsNamespace.User,
				action: UserAction.Session,
				uuid: payload.token.tuuid,
				active: false
			});
		}
	};

	async APIHandler(
		user: Intra42User | DiscordUser | TwitterUser,
		http: { req: Request; headers: Headers; res: Response }
	) {
		const fingerprint = getFingerprint(http.req, http.headers);

		const ret = await this.login.byAPI(user, fingerprint);
		// prettier-ignore
		if (!ret) {
			const partial_user = getPartialUser(user);

			http.res.redirect(`/#/postsignup/with?username=${partial_user.username}&email=${partial_user.email}&avatar=${partial_user.avatar}`);
		} else if (ret.interface === 'TwoFactorRequest') {
			this.cookie.create(http.res, { twofactor_token: ret.token });

			http.res.redirect('/#/login/2fa');
		} else if (ret.interface === 'GeneratedTokens') {
			const { access_token, refresh_token } = ret;
			this.cookie.create(http.res, { access_token });
			this.cookie.create(http.res, { refresh_token });

			http.res.redirect('/');
		}
	}

	public readonly twoFactor = {
		demand: async (user: UsersInfos): Promise<TwoFactorSetupRequest> => {
			if (user.twofactor) {
				this.logger.verbose('User already have 2FA enabled ' + user.uuid);
				throw new BadRequestException(ApiResponseError.TwoFactorAlreadySet);
			}

			return (await this.twoFactorService.demand(user)) as TwoFactorSetupRequest;
		},
		login: async (request_uuid: string, fingerprint: UserFingerprint) => {
			this.logger.debug('2FA request is valid ' + request_uuid);

			const user = await this.twoFactorService.getUserFromRequest(request_uuid);

			await this.twoFactorService.delete(request_uuid);

			return await this.tokensService.create({
				uuid: user.uuid,
				fingerprint
			});
		}
	};
}