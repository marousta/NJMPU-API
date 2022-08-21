import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { UsersModule } from './users/users.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
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
		UsersModule
	]
})
export class AppModule {}
