import { Logger } from '@nestjs/common';

import { isEmpty } from '../utils';

import { colors } from '../types';

export class wsLogger extends Logger {
	private client = '';

	constructor(args: any) {
		super(args);
	}

	private format() {
		return this.client !== '' ? `${colors.green}[${this.client}]${colors.end} ` : '';
	}

	set(uuid?: string) {
		if (isEmpty(uuid)) {
			this.client = '';
			return this;
		}
		this.client = uuid;
		return this;
	}

	unset() {
		this.client = '';
	}

	log(message: any, ...optionalParams: any[]) {
		super.log(this.format() + message, ...optionalParams);
		return this;
	}
	error(message: any, ...optionalParams: any[]) {
		super.error(this.format() + message, ...optionalParams);
		return this;
	}
	warn(message: any, ...optionalParams: any[]) {
		super.warn(this.format() + message, ...optionalParams);
		return this;
	}
	debug(message: any, ...optionalParams: any[]) {
		super.debug(this.format() + message, ...optionalParams);
		return this;
	}
	verbose(message: any, ...optionalParams: any[]) {
		super.verbose(this.format() + message, ...optionalParams);
		return this;
	}
}
