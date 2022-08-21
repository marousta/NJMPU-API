export interface PartialUsersInfos {
	uuid?: string;
	username?: string;
	password?: string;
	profile_picture?: string;
	is_online?: string;
}

export interface JwtPayload extends PartialUsersInfos {
	creation_date?: Date;
	platform: string;
	access_token?: string;
	refresh_token?: string;
	ua: string;
	ip: string;
}
