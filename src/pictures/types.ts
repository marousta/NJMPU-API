import { ApiProperty } from '@nestjs/swagger';

export class PicturesResponse {
	@ApiProperty()
	avatar: string;
}

export interface MulterFileLike {
	filename: string;
	originalname: string;
}

export enum ApiResponseError {
	ImgTooLarge = 'Image too large',
}
