import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException,
	NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import e, { Request, Response } from 'express';
import { createHash } from 'crypto';

import { UsersService } from '../users/users.service';
import { TokensService } from './tokens/tokens.service';
import { PicturesService } from '../pictures/pictures.service';
import { TwoFactorService } from './2fa/2fa.service';

import { SignupProperty } from './properties/signup.property';

import { UsersInfos } from '../users/users.entity';

import {
	DiscordUser,
	GeneratedTokens,
	Intra42User,
	JwtPayload,
	UserFingerprint,
	TwoFactorRequest
} from './types';
import { getPartialUser, isEmpty, getFingerprint } from '../utils';

@Injectable()
export class AuthService {
	constructor(
		private configService: ConfigService,
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly usersService: UsersService,
		private readonly tokensService: TokensService,
		private readonly twoFactorService: TwoFactorService,
		private readonly pictureService: PicturesService
	) {}

	async validateUser(email: string, password: string): Promise<UsersInfos> {
		const user = await this.usersRepository.findOneByOrFail({ email }).catch((e) => {
			throw new UnauthorizedException();
		});

		const verif = await argon2.verify(user.password, password);
		if (!verif) {
			throw new UnauthorizedException();
		}
		return user;
	}

	public readonly login = {
		byPassword: async (
			payload: JwtPayload,
			fingerprint: UserFingerprint
		): Promise<GeneratedTokens | TwoFactorRequest> => {
			const user = await this.usersRepository
				.findOneByOrFail({ uuid: payload.uuid })
				.catch((e) => {
					console.error(e);
					throw new InternalServerErrorException();
				});

			if (user.twofactor) {
				return await this.twoFactorService.demand(user);
			}

			return await this.tokensService.create({
				uuid: payload.uuid,
				fingerprint
			});
		},
		byAPI: async (
			user: Intra42User | DiscordUser,
			fingerprint: UserFingerprint
		): Promise<GeneratedTokens | TwoFactorRequest> => {
			const parital_user = getPartialUser(user);

			try {
				const exist = await this.usersRepository.findOneByOrFail({
					email: parital_user.email
				});

				if (exist.twofactor) {
					return await this.twoFactorService.demand(exist);
				}

				return await this.tokensService.create({
					uuid: exist.uuid,
					fingerprint
				});
			} catch (e) {
				console.error(e);
				return null;
			}
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
				expires = new Date(expires.valueOf() + 60 * 10 * 1000); // 10m
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
			res.cookie(name, null, {
				domain: this.configService.get<string>('DOMAIN'),
				sameSite: 'strict',
				httpOnly: true
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
				throw new BadRequestException('Empty field');
			}

			if (params.password !== params.confirm) {
				throw new BadRequestException('Password missmatch');
			}

			const new_user = this.usersRepository.create({
				identifier: await this.usersService.getIdentfier(params.username),
				username: params.username,
				email: params.email,
				password: await argon2.hash(params.password, { timeCost: 11, saltLength: 128 })
			});

			const created_user = await this.usersRepository.save(new_user).catch((e) => {
				if (/email|exists/.test(e.detail)) {
					throw new BadRequestException('Email address already in use');
				} else {
					console.error(e);
					throw new BadRequestException();
				}
			});

			if (params.profile_picture) {
				const hash = createHash('sha1').update(created_user.uuid).digest('hex');
				const profile_picture: string | null = await this.pictureService
					.download(hash, params.profile_picture)
					.catch((e) => {
						console.error(e);
						return null;
					});

				await this.usersRepository.save({ ...new_user, profile_picture }).catch((e) => {
					console.error(e);
					throw new BadRequestException();
				});
			}
		},
		disconnect: async (user: any) => {
			await this.tokensService.delete(user.id);
		}
	};

	async APIHandler(
		user: Intra42User | DiscordUser,
		http: { req: Request; headers: Headers; res: Response }
	) {
		const fingerprint = getFingerprint(http.req, http.headers);

		let ret = await this.login.byAPI(user, fingerprint);

		if (!ret) {
			const partial_user = getPartialUser(user);
			http.res.redirect(
				`/#/postsignup/with/${partial_user.username}/${partial_user.email}/${partial_user.profile_picture}`
			);
			return;
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
		demand: async (payload: JwtPayload): Promise<TwoFactorRequest> => {
			const user = await this.usersRepository
				.findOneByOrFail({ uuid: payload.uuid })
				.catch((e) => {
					console.error(e);
					throw new NotFoundException();
				});

			if (user.twofactor) {
				throw new BadRequestException();
			}

			return await this.twoFactorService.demand(user);
		},
		login: async (request_uuid: string, fingerprint: UserFingerprint) => {
			let user = await this.twoFactorService.user(request_uuid);
			await this.twoFactorService.delete(request_uuid);
			return await this.tokensService.create({
				uuid: user.uuid,
				fingerprint
			});
		}
	};
}
