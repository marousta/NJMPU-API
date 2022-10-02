import { PicturesService } from './pictures.service';
import { FileInterceptor } from '@nestjs/platform-express';

export const PicturesInterceptor = FileInterceptor('avatar', {
	fileFilter(req, file, callback) {
		PicturesService.parseContentType(file.mimetype);
		callback(null, true);
	}
});
