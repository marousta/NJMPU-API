import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as requestIp from 'request-ip';

import { AppModule } from './app/app.module';

import { colors } from './types';

import { AuthenticatedWsAdapter } from './websockets/ws.adapter';
import { existsSync, mkdirSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';

class ValidateEnv {
	error = false;

	private log(text: string) {
		console.error(colors.red + text + colors.end);
	}

	private exist(variable: string): string | null {
		const value: string | undefined = process.env[variable];

		if (!value || value === '') {
			this.log('env ' + variable + ' is missing.');
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

async function bootstrap() {
	const env = new ValidateEnv();
	env.check('DOMAIN', 'string');
	env.check('IMG_PATH', 'string');
	env.check('IMG_MAX_SIZE', 'number');
	env.check('JWT_PRIVATE', 'string');
	env.check('PSQL_HOST', 'string');
	env.check('PSQL_PORT', 0);
	env.check('PSQL_USERNAME', 'string');
	env.check('PSQL_PASSWORD', 'string');
	env.check('PSQL_DATABASE', 'string');
	env.check('PSQL_SYNC', false);
	env.check('INTRA42_ID', 'string');
	env.check('INTRA42_SECRET', 'string');
	env.check('INTRA42_CALLBACK', 'string');
	env.check('DISCORD_ID', 'string');
	env.check('DISCORD_SECRET', 'string');
	env.check('DISCORD_CALLBACK', 'string');
	env.result();

	const app = await NestFactory.create(AppModule);

	app.setGlobalPrefix('api');

	app.enableCors();

	app.use(cookieParser());
	app.use(requestIp.mw());

	app.useWebSocketAdapter(new AuthenticatedWsAdapter(app));

	const shared = resolve(app.get(ConfigService).get<string>('IMG_PATH'));
	if (!existsSync(shared)) {
		mkdirSync(shared);
	}

	const config = new DocumentBuilder()
		.setTitle('NEW SHINJI MEGA PONG ULTIMATE API')
		.setDescription('API reference sheet')
		.setVersion('0.3.6')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('/api', app, document, {
		swaggerOptions: {
			tagsSorter: 'alpha'
		}
	});

	await app.listen(3000);
}
bootstrap();
