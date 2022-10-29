import { ConsoleLogger } from '@nestjs/common';

export class DisabledLogger extends ConsoleLogger {
	log(message: any, ...optionalParams: any[]) {
		super.log(message, ...optionalParams);
	}
	error(message: any, ...optionalParams: any[]) {
		super.error(message, ...optionalParams);
	}
	warn(message: any, ...optionalParams: any[]) {
		super.warn(message, ...optionalParams);
	}
	debug(message: any, ...optionalParams: any[]) {
		// super.debug(message, ...optionalParams);
	}
	verbose(message: any, ...optionalParams: any[]) {
		// super.verbose(message, ...optionalParams);
	}
}
