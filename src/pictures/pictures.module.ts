import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { HttpModule } from '@nestjs/axios';
import { resolve } from 'path';

import { PicturesService } from './pictures.service';
import { PicturesController } from './pictures.controller';

import { AuthModule } from '../auth/auth.module';
import { ChatsModule } from '../chats/chats.module';
import { UsersModule } from '../users/users.module';

@Module({
	imports: [
		HttpModule.register({
			timeout: 3000
		}),
		MulterModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				dest: resolve(configService.get<string>('IMG_PATH')),
				limits: { fileSize: 1024 * 1024 * configService.get<number>('IMG_MAX_SIZE') }
			})
		}),
		ChatsModule,
		UsersModule
		// AuthModule
	],
	providers: [PicturesService],
	controllers: [PicturesController],
	exports: [PicturesService]
})
export class PicturesModule {}
