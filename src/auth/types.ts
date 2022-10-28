import { UsersInfos } from '../users/entities/users.entity';
export interface PartialUsersInfos {
	uuid?: string;
	identifier?: number;
	username?: string;
	email?: string;
	password?: string;
	twofactor?: boolean;
	avatar?: string;
	is_online?: string;
}

export interface UserFingerprint {
	platform: string;
	ua: string;
	ip: string;
}
export interface JwtPayload extends PartialUsersInfos {
	creation_date?: Date;
	access_token?: string;
	refresh_token?: string;
	fingerprint?: UserFingerprint;
}

export interface Jwt {
	id: number;
	iat: number;
	exp: number;
}

export interface Jwt2FA extends Jwt {
	uuid: string;
}

export interface JwtData {
	token: Jwt;
	infos: UsersInfos;
}

export interface GeneratedTokens {
	interface: 'GeneratedTokens';
	access_token: string;
	refresh_token: string;
}

export interface Intra42User {
	interface: 'Intra42User';
	id: string;
	username: string;
	displayName: string;
	name: {
		familyName: string;
		givenName: string;
	};
	profileUrl: string;
	emails: Array<{ value: string }>;
	phoneNumbers: Array<{ value: string }>;
	photos: Array<{ value: string }>;
	provider: string;
}

export interface DiscordUser {
	interface: 'DiscordUser';
	id: string;
	username: string;
	avatar: string;
	avatar_decoration: string;
	discriminator: string;
	public_flags: number;
	flags: number;
	banner: string;
	banner_color: string;
	accent_color: string;
	locale: string;
	mfa_enabled: boolean;
	email: string;
	verified: boolean;
	provider: string;
	accessToken: string;
	fetchedAt: Date;
}

export interface TwoFactorRequest {
	interface: 'TwoFactorRequest';
	uuid: string;
	token: string;
}

export interface TwoFactorSetupRequest extends TwoFactorRequest {
	image: string;
	text: string;
}

export enum ApiResponseError {
	EmptyFields = 'Empty fields',
	EmailTaken = 'Email already in use',
	Passwordmismatch = 'Password mismatch',
	InvalidCredentials = 'Invalid credentials',
	TwoFactorInvalidCode = '2FA code is invalid',
	TwoFactorInvalidRequest = 'No ongoing 2FA request',
	TwoFactorAlreadySet = '2FA already set',
	MissingSession = 'Missing session id',
	InvalidSession = 'Invalid session id'
}
