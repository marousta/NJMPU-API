import { colors } from './types';

export class ValidateEnv {
	error = false;

	private log(text: string) {
		console.error(colors.red + text + colors.end);
	}

	private checkProtocol(protocol: string) {
		return protocol === 'http' || protocol == 'https';
	}

	private exist(variable: string): string | null {
		const value: string | undefined = process.env[variable];

		if (!value || value === '') {
			this.log('env ' + variable + ' is missing.');
			this.error = true;
			return null;
		}
		if (variable === 'PROTOCOL' && !this.checkProtocol(value)) {
			this.log('Invalid ' + variable + ', expected http or https, got ' + value + '.');
			this.error = true;
			return null;
		}
		return value;
	}

	check(variable: string, type: any) {
		const value = this.exist(variable);
		if (!value) {
			return;
		}
		switch (typeof type) {
			case 'string':
				return;
			case 'number':
				if (isNaN(parseInt(value))) {
					this.log(variable + ' should be a number.');
					this.error = true;
				}
				return;
			case 'boolean':
				if (value !== 'true' && value !== 'false') {
					this.log(variable + ' should be a boolean.');
					this.error = true;
				}
				return;
			default:
				this.log(variable + ' type is unknown.');
				this.error = true;
				return;
		}
	}

	result() {
		if (this.error) {
			this.log('\nMissing arguments.\n');
			process.exit(1);
		}
	}
}
