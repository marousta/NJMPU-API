import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PictureService } from './picture.service';

@Module({
	imports: [
		HttpModule.register({
			timeout: 3000
		})
	],
	providers: [PictureService]
})
export class PictureModule {}
