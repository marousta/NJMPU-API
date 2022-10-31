import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { HttpModule } from '@nestjs/axios';
import { HelmetMiddleware } from '@nest-middleware-collection/helmet';

import { ResponseTimeMiddleware } from './middlewares/time.middleware';

import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PicturesModule } from '../pictures/pictures.module';
import { WsModule } from '../websockets/ws.module';
import { ChatsModule } from '../chats/chats.module';

import { AppController } from './app.controller';

import { AppService } from './services/app.service';

import { SessionModule } from 'nestjs-session';

@Module({
	imports: [
		HttpModule,
		SessionModule.forRoot({
			session: { secret: 'keyboard cat' }
		}),
		ConfigModule.forRoot({
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				type: 'postgres',
				host: configService.get<string>('PSQL_HOST'),
				port: configService.get<number>('PSQL_PORT'),
				username: configService.get<string>('PSQL_USERNAME'),
				password: configService.get<string>('PSQL_PASSWORD'),
				database: configService.get<string>('PSQL_DATABASE'),
				entities: ['dist/**/*.entity{.ts,.js}'],
				synchronize: configService.get<boolean>('PSQL_SYNC'),
				namingStrategy: new SnakeNamingStrategy(),
				migrations: ['dist/database-migration/*{.ts,.js}'],
				logging: false
			})
		}),
		WsModule,
		AuthModule,
		UsersModule,
		ChatsModule,
		PicturesModule
	],
	providers: [AppService],
	controllers: [AppController]
})
export class AppModule {
	constructor(private readonly config: ConfigService) {}

	configure(consumer: MiddlewareConsumer) {
		if (this.config.get<string>('DOMAIN') === 'localhost') {
			HelmetMiddleware.configure({
				hsts: false
			});
		}
		consumer.apply(HelmetMiddleware).forRoutes('*');
		consumer.apply(ResponseTimeMiddleware).forRoutes('*');
	}
}
