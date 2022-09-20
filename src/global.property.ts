import { ApiPropertyOptional } from '@nestjs/swagger';

export class GlobalQueryProperty {
	@ApiPropertyOptional()
	page: number;

	@ApiPropertyOptional()
	limit: number;

	@ApiPropertyOptional()
	offset: number;
}
