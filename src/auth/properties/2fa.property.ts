import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorProperty {
	@ApiProperty()
	code: string;
}
