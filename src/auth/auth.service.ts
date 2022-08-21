import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { Response } from 'express';

import { UsersService } from '../users/users.service';
import { SignupProperty } from './properties/signup.property';
import { UsersInfos } from '../users/users.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TokensService } from './tokens/tokens.service';
import { JwtPayload } from './types';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(UsersInfos)
		private usersRepository: Repository<UsersInfos>,
		private usersService: UsersService,
		private TokensService: TokensService
	) {}

	async validateUser(username: string, password: string): Promise<any> {
		try {
			const user = await this.usersService.findOne({
				where: {
					username: username
				}
			});

			const verif = await argon2.verify(user.password, password);
			if (!verif) {
				throw new Error();
			}
			return user;
		} catch (e) {
			console.error(e);
			throw new UnauthorizedException();
		}
	}

	async login(user: JwtPayload, platform: string, ua: string, ip: string) {
		const payload = {
			uuid: user.uuid,
			username: user.username,
			platform,
			ua,
			ip
		};

		return await this.TokensService.create(payload);
	}

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
				username: params.username,
				password: await argon2.hash(params.password, {
					timeCost: 11,
					saltLength: 128
				})
			});

			try {
				console.log(await this.usersRepository.save(newUser));
			} catch (e) {
				if (/username|exist/.test(e.detail)) {
					throw new BadRequestException('Username already taken');
				} else {
					console.error(e);
					throw new BadRequestException();
				}
			}
			return true;
		},
		disconnect: async (user: any) => {
			await this.TokensService.delete(user.id);
		}
	};
}
