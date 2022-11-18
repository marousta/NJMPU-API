import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as requestIp from 'request-ip';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

import { AppModule } from './app/app.module';

import { DisabledLogger } from './app/services/disabledLogger.service';

import { ValidateEnv } from './validateEnv';
import { max_spectators } from './games/config';

import { parseUnsignedNull } from './utils';

import { colors } from './types';

async function bootstrap() {
	const env = new ValidateEnv();
	env.check('PROTOCOL', 'string');
	env.check('DOMAIN', 'string');
	env.check('IMG_PATH', 'string');
	env.check('IMG_MAX_SIZE', 0);
	env.check('JWT_PRIVATE', 'string');
	env.check('JWT_PUBLIC', 'string');
	env.check('PSQL_HOST', 'string');
	env.check('PSQL_PORT', 0);
	env.check('PSQL_USERNAME', 'string');
	env.check('PSQL_PASSWORD', 'string');
	env.check('PSQL_DATABASE', 'string');
	env.check('PSQL_SYNC', false);
	env.result();

	if (!parseUnsignedNull(max_spectators)) {
		console.error(colors.red + 'Invalid game/config: max_spectators' + colors.end);
		process.exit(1);
	}

	const app = await NestFactory.create(AppModule, {
		logger: process.env['PRODUCTION'] ? new DisabledLogger() : undefined
	});

	app.setGlobalPrefix('api');

	app.enableCors();

	app.use(cookieParser());
	app.use(requestIp.mw());

	app.useWebSocketAdapter(new WsAdapter(app));

	const shared = resolve(app.get(ConfigService).get<string>('IMG_PATH'));
	if (!existsSync(shared)) {
		mkdirSync(shared);
	}

	if (!process.env['PRODUCTION']) {
		const config = new DocumentBuilder()
			.setTitle('NEW SHINJI MEGA PONG ULTIMATE API')
			.setDescription('API reference sheet')
			.setVersion('0.7')
			.build();
		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('/api', app, document, {
			customSiteTitle: 'API - NEW SHINJI MEGA PONG ULTIMATE',
			swaggerOptions: {
				tagsSorter: 'alpha'
			}
		});
	}

	await app.listen(3000);
}
bootstrap();
