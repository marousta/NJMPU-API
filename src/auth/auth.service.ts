import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Response } from 'express';

import { UsersService } from '../users/users.service';
import { TokensService } from './tokens/tokens.service';

import { SignupProperty } from './properties/signup.property';

import { UsersInfos } from '../users/users.entity';

import { GeneratedTokens, Intra42User, JwtPayload, UserFingerprint } from './types';
import { LoginMethod } from '../types';
import { PictureService } from '../picture/picture.service';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(UsersInfos)
		private readonly usersRepository: Repository<UsersInfos>,
		private readonly usersService: UsersService,
		private readonly tokensService: TokensService,
		private readonly pictureService: PictureService
	) {}

	async validateUser(email: string, password: string): Promise<UsersInfos> {
		try {
			const user = await this.usersRepository.findOneByOrFail({ email });

			if (user.account_type === LoginMethod.intra42) {
				throw new Error('Invalid login method try login with 42');
			}

			if (user.account_type !== LoginMethod.password) {
				throw new Error("Login method doesn't match");
			}

			const verif = await argon2.verify(user.password, password);
			if (!verif) {
				throw new UnauthorizedException();
			}
			return user;
		} catch (e) {
			throw new UnauthorizedException();
		}
	}

	public readonly login = {
		byPassword: async (user: JwtPayload, fingerprint: UserFingerprint) => {
			return await this.tokensService.create({
				uuid: user.uuid,
				fingerprint
			});
		},
		byAPI: async (user: Intra42User, fingerprint: UserFingerprint): Promise<GeneratedTokens | null> => {
			try {
				const exist = await this.usersRepository.findOneByOrFail({
					identifier: 42,
					username: user.username,
					email: user.emails[0].value
				});
				return await this.tokensService.create({
					uuid: exist.uuid,
					fingerprint
				});
			} catch (e) {
				return null;
			}
		}
	};

	public readonly cookie = {
		create: (res: Response, obj: { access_token: string } | { refresh_token: string }) => {
			const name = Object.keys(obj)[0];

			let expires = new Date();

			if (name === 'access_token') {
				expires = new Date(expires.valueOf() + 60 * 10 * 1000); // 10m
			} else if (name === 'refresh_token') {
				expires = new Date(expires.valueOf() + 60 * 60 * 24 * 3 * 1000); //3d
			}

			res.cookie(name, Object.values(obj)[0], {
				domain: 'localhost', //TODO
				httpOnly: true,
				expires
			});
		},
		delete: (res: Response, name: string) => {
			res.cookie(name, null, {
				domain: 'localhost', //TODO
				httpOnly: true
			});
		}
	};

	public readonly user = {
		create: async (params: SignupProperty) => {
			if (params.password !== params.confirm) {
				throw new BadRequestException('Password missmatch');
			}

			const newUser = this.usersRepository.create({
				account_type: LoginMethod.password,
				identifier: await this.usersService.getIdentfier(params.username),
				username: params.username,
				email: params.email,
				password: await argon2.hash(params.password, {
					timeCost: 11,
					saltLength: 128
				})
			});

			try {
				await this.usersRepository.save(newUser);
			} catch (e) {
				if (/email|exists/.test(e.detail)) {
					throw new BadRequestException('Email address already in use');
				} else {
					console.error(e);
					throw new BadRequestException();
				}
			}
			return true;
		},
		createFromAPI: {
			intra42: async (user: Intra42User) => {
				let pp: string | null = null;
				try {
					pp = await this.pictureService.download(user.username, 42, user.photos[0].value);
				} catch (e) {}

				const newUser = this.usersRepository.create({
					account_type: LoginMethod.intra42,
					identifier: 42,
					email: user.emails[0].value,
					username: user.username,
					profile_picture: pp
				});

				try {
					await this.usersRepository.save(newUser);
				} catch (e) {
					if (/Key|exists/.test(e.detail)) {
						throw new InternalServerErrorException();
					} else {
						console.error(e);
						throw new BadRequestException();
					}
				}
			}
		},
		disconnect: async (user: any) => {
			await this.tokensService.delete(user.id);
		}
	};
}
