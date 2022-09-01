import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller()
export class AppController {
	@ApiTags('stats')
	@Get('stats')
	stats(@Request() req) {
		return req.times;
	}
}
