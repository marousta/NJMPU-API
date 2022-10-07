import * as argon2 from 'argon2';

import { verif_config } from './config';

export function hash(data: string, config: object): Promise<string> {
	return argon2.hash(data, config);
}

export function hash_verify(hash: string, data: string) {
	return argon2.verify(hash, data, verif_config);
}
