import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

import {
	DiscordUser,
	Intra42User,
	PartialUsersInfos,
	UserFingerprint,
	TwitterUser,
	ApiResponseError as ApiResponseErrorAuth,
} from './auth/types';
import { ApiResponseError as ApiResponseErrorChat } from './chats/types';

export function getPlatform(headers: Headers): string {
	const ua = new UAParser(headers['user-agent']);
	const browser = ua.getBrowser().name;
	const os = ua.getOS().name;
	return `${browser} ${os}`;
}

export function getFingerprint(req: Request, headers: Headers): UserFingerprint {
	return {
		platform: getPlatform(headers),
		ua: headers['user-agent'],
		ip: req.clientIp,
	};
}

export function getPartialUser(user: Intra42User | DiscordUser | TwitterUser): PartialUsersInfos {
	switch (user.interface) {
		case 'Intra42User':
			return {
				username: user.login,
				email: user.email,
				avatar: user.image.versions.large,
			};
		case 'DiscordUser':
			return {
				username: user.username,
				email: user.email,
				avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}?size=256`,
			};
		case 'TwitterUser':
			return {
				username: user.username,
				email: user.emails[0].value,
				avatar: user.photos[0].value.replace('_normal', ''),
			};
		default:
			new Logger('getPartialUser').error('unknown user type ', user);
			throw new InternalServerErrorException();
	}
}

export function isEmpty(str: string): boolean {
	return !str || !str.trim().length || str === 'undefined' || str === 'string';
}

function randomEntry(array: number[]): number {
	const randomIndex = Math.floor(Math.random() * array.length);
	return array[randomIndex];
}

function genArray(): number[] {
	let arr: number[] = [];
	for (let i = 0; i <= 9999; ++i) {
		arr.push(i);
	}
	return arr;
}

export function genIdentifier(exclude: number[]): number | null {
	const filtered = genArray().filter((i) => !exclude.includes(i));
	if (filtered.length) {
		return randomEntry(filtered);
	}
	return null;
}

export function parseUnsigned(raw: object) {
	const name = Object.keys(raw)[0];

	const value = parseInt(Object.values(raw)[0]);
	if (isNaN(value) || value < 0) {
		throw new BadRequestException('Invalid ' + name + ' number');
	}
	return value;
}

export function parseUnsignedNull(raw: any) {
	const value = parseInt(raw);
	if (isNaN(value) || value < 0) {
		return null;
	}
	return value;
}

export function peerOrPeers(i: number) {
	return i != 1 ? 'peers' : 'peer';
}

export function dateFromOffset(offset: number) {
	return new Date(new Date().valueOf() + offset * 1000);
}

export function checkUsername(username: string) {
	let errors: Array<string> = [];

	if (username.length > 16) {
		errors.push(ApiResponseErrorAuth.UsernameTooLong);
	}

	const validCharacters: Array<string> = [
		...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789',
	];

	if ([...username].filter((c) => !validCharacters.includes(c)).length > 0) {
		errors.push(ApiResponseErrorAuth.UsernameWrongFormat);
	}

	return errors;
}

export function checkChannelName(name: string) {
	let errors: Array<string> = [];

	if (name.length > 26) {
		errors.push(ApiResponseErrorChat.NameTooLong);
	}

	const validCharacters: Array<string> = [
		...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789',
	];

	if ([...name].filter((c) => !validCharacters.includes(c)).length > 0) {
		errors.push(ApiResponseErrorChat.NameWrongFormat);
	}

	return errors;
}

export function checkPassword(password: string) {
	let errors: Array<string> = [];

	if (password.length === 0) {
		errors.push(ApiResponseErrorAuth.PasswordEmpty);
	}

	if (password.length > 100) {
		errors.push(ApiResponseErrorAuth.PasswordTooLong)
	}

	if (password.length < 8) {
		errors.push(ApiResponseErrorAuth.PasswordTooShort);
	}

	if (password.toLowerCase() === password || password.toUpperCase() === password) {
		errors.push(ApiResponseErrorAuth.PasswordWrongFormatCase);
	}

	const numbers: Array<string> = [...'0123456789'];

	if ([...password].filter((c) => numbers.includes(c)).length === 0) {
		errors.push(ApiResponseErrorAuth.PasswordWrongFormatNumeric);
	}

	const specialChars: Array<string> = [...`"'/|!@#$%^&*()[]{}<>`];

	if ([...password].filter((c) => specialChars.includes(c)).length === 0) {
		errors.push(ApiResponseErrorAuth.PasswordWrongFormatSpecial);
	}

	return errors;
}
