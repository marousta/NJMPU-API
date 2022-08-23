export interface PartialUsersInfos {
	uuid?: string;
	identifier?: number;
	username?: string;
	email?: string;
	password?: string;
	profile_picture?: string;
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

export interface GeneratedTokens {
	access_token: string;
	refresh_token: string;
}

export interface Intra42User {
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
