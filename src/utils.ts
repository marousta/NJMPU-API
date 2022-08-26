import { InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

import { DiscordUser, Intra42User, PartialUsersInfos, UserFingerprint } from './auth/types';

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
		ip: req.clientIp
	};
}

export function getPartialUser(user: Intra42User | DiscordUser): PartialUsersInfos {
	switch (user.interface) {
		case 'Intra42User':
			return {
				username: user.username,
				email: user.emails[0].value,
				profile_picture: user.photos[0].value
			};
		case 'DiscordUser':
			return {
				username: user.username,
				email: user.email,
				profile_picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}?size=256`
			};
		default:
			console.error('unknow user type');
			throw new InternalServerErrorException();
	}
}

export function isEmpty(str: string): boolean {
	return !str || !str.trim().length;
}
