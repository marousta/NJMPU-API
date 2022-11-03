import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { FastifyRequest } from 'fastify';

@Controller()
export class AppController {
	@ApiTags('stats')
	@Get('stats')
	stats(@Request() req: FastifyRequest) {
		return req.headers['times'];
	}
}
