import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';

import { PictureService } from './picture.service';

@Module({
	imports: [
		ConfigModule,
		HttpModule.register({
			timeout: 3000
		})
	],
	providers: [PictureService, ConfigService]
})
export class PictureModule {}
