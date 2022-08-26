import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PicturesService } from './pictures.service';

@Module({
	imports: [
		HttpModule.register({
			timeout: 3000
		})
	],
	providers: [PicturesService]
})
export class PicturesModule {}
