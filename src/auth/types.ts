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
	tuuid: string;
	uuuid?: string;
	iat: number;
	exp: number;
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
	id: number;
	email: string;
	login: string;
	first_name: string;
	last_name: string;
	usual_full_name: string;
	usual_first_name: string;
	url: string;
	phone?: any;
	displayname: string;
	kind: string;
	image: {
		link: string;
		versions: {
			large: string;
			medium: string;
			small: string;
			micro: string;
		};
	};
	staff?: boolean;
	correction_point: number;
	pool_month: string;
	pool_year: string;
	location?: any;
	wallet: number;
	anonymize_date: Date;
	data_erasure_date?: any;
	alumni?: boolean;
	active?: boolean;
	groups: any[];
	cursus_users: [
		{
			id: number;
			begin_at: Date;
			end_at?: any;
			grade?: any;
			level: number;
			skills: any[];
			cursus_id: number;
			has_coalition: boolean;
			user: {
				id: number;
				login: string;
				url: string;
			};
			cursus: {
				id: number;
				created_at: Date;
				name: string;
				slug: string;
			};
		},
	];
	projects_users: any[];
	languages_users: [
		{
			id: number;
			language_id: number;
			user_id: number;
			position: number;
			created_at: Date;
		},
	];
	achievements: any[];
	titles: any[];
	titles_users: any[];
	partnerships: any[];
	patroned: [
		{
			id: number;
			user_id: number;
			godfather_id: number;
			ongoing: boolean;
			created_at: Date;
			updated_at: Date;
		},
	];
	patroning: any[];
	expertises_users: [
		{
			id: number;
			expertise_id: number;
			interested: boolean;
			value: number;
			contact_me: boolean;
			created_at: Date;
			user_id: number;
		},
	];
	roles: any[];
	campus: [
		{
			id: number;
			name: string;
			time_zone: string;
			language: {
				id: number;
				name: string;
				identifier: string;
				created_at: Date;
				updated_at: Date;
			};
			users_count: number;
			vogsphere_id: number;
		},
	];
	campus_users: [
		{
			id: number;
			user_id: number;
			campus_id: number;
			is_primary: boolean;
		},
	];
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

export interface TwitterUser {
	interface: 'TwitterUser';
	id: string;
	username: string;
	displayName: string;
	emails: Array<{ value: string }>;
	photos: Array<{ value: string }>;
	provider: string;
	_raw: string;
	_json: {
		id: number;
		id_str: string;
		name: string;
		screen_name: string;
		location: string;
		description: string;
		url: string;
		entities: { url: Array<object>; description: Array<object> };
		protected: boolean;
		followers_count: number;
		friends_count: number;
		listed_count: number;
		created_at: Date;
		favourites_count: number;
		utc_offset: null;
		time_zone: null;
		geo_enabled: boolean;
		verified: boolean;
		statuses_count: number;
		lang: null;
		status: {
			created_at: Date;
			id: number;
			id_str: string;
			text: string;
			truncated: boolean;
			entities: Array<object>;
			source: string;
			in_reply_to_status_id: number;
			in_reply_to_status_id_str: string;
			in_reply_to_user_id: number;
			in_reply_to_user_id_str: string;
			in_reply_to_screen_name: string;
			geo: string;
			coordinates: string;
			place: string;
			contributors: string;
			is_quote_status: boolean;
			retweet_count: number;
			favorite_count: number;
			favorited: boolean;
			retweeted: boolean;
			lang: string;
		};
		contributors_enabled: boolean;
		is_translator: boolean;
		is_translation_enabled: boolean;
		profile_background_color: string;
		profile_background_image_url: string;
		profile_background_image_url_https: string;
		profile_background_tile: true;
		profile_image_url: string;
		profile_image_url_https: string;
		profile_banner_url: string;
		profile_link_color: string;
		profile_sidebar_border_color: string;
		profile_sidebar_fill_color: string;
		profile_text_color: string;
		profile_use_background_image: true;
		has_extended_profile: true;
		default_profile: boolean;
		default_profile_image: boolean;
		following: boolean;
		follow_request_sent: boolean;
		notifications: boolean;
		translator_type: string;
		withheld_in_countries: Array<string>;
		suspended: boolean;
		needs_phone_verification: boolean;
	};
	_accessLevel: string;
}

export interface TwoFactorRequest {
	interface: 'TwoFactorRequest';
	tuuid: string;
	token: string;
}

export interface TwoFactorSetupRequest extends TwoFactorRequest {
	image: string;
	text: string;
}

export enum ApiResponseError {
	EmptyFields = 'Empty fields',
	PasswordMismatch = 'Password mismatch',
	InvalidCredentials = 'Invalid credentials',
	TwoFactorInvalidCode = '2FA code is invalid',
	TwoFactorInvalidRequest = 'No ongoing 2FA request',
	TwoFactorAlreadySet = '2FA already set',
	TwoFactorNotSet = '2FA not set',
	MissingSession = 'Missing session uuid',
	InvalidSession = 'Invalid session uuid',
	UsernameTooLong = 'Usernames are limited to 16 characters',
	UsernameWrongFormat = 'Usernames are limited to alphanumerical characters and underscores',
	PasswordEmpty = 'Password cannot be empty',
	PasswordTooShort = 'Password should be at least 8 characters long',
	PasswordTooLong = 'Password are limited to 100 characters',
	PasswordWrongFormatCase = 'Password should contain uppercase AND lowercase letters',
	PasswordWrongFormatNumeric = 'Password should contain numbers',
	PasswordWrongFormatSpecial = 'Password should contain special characters -> ' +
		`"'/|!@#$%^&*()[]{}<>`,
	EmailInvalid = 'Email address is incorrect',
}
