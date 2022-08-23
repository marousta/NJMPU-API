import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PictureModule } from './picture/picture.module';

import { AppController } from './app.controller';

import { PictureService } from './picture/picture.service';
import { HttpModule } from '@nestjs/axios';

@Module({
	imports: [
		PictureModule,
		HttpModule,
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
				migrations: ['dist/database-migration/*{.ts,.js}']
			})
		}),
		UsersModule,
		AuthModule
	],
	controllers: [AppController],
	providers: [PictureService]
})
export class AppModule {}
