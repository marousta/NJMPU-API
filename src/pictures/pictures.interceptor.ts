import { FileInterceptor } from '@nestjs/platform-express';

import { PicturesService } from './pictures.service';

export const PicturesInterceptor = FileInterceptor('avatar', {
	fileFilter(req, file, callback) {
		try {
			PicturesService.parseContentType(file.mimetype);
			callback(null, true);
		} catch (e) {
			callback(e, false);
		}
	}
});
