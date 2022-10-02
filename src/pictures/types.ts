import { ApiProperty } from '@nestjs/swagger';

export class PicturesReponse {
	@ApiProperty()
	avatar: string;
}
