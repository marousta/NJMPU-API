import { randomUUID } from 'crypto';

import { UsersInfos } from '../../users/entities/users.entity';

import { token_time } from '../config';

export class UsersTwofactorReq {
	constructor(arg: { uuid?: string; user: UsersInfos; secret?: string; token_hash?: string }) {
		this.uuid = arg.uuid ?? randomUUID();
		this.user = arg.user;
		this.secret = arg.secret ?? null;
		this.token_hash = arg.token_hash ?? null;
		this.expiration = token_time.twofactor();
	}

	uuid: string;
	user: UsersInfos;
	secret: string;
	token_hash: string;
	expiration: Date;
}
