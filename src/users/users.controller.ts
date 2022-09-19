import { Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { UsersService } from './users.service';
import { BadRequestException } from '@nestjs/common';
import { UserGetResponse } from './users.property';

@UseGuards(AuthGuard('access'))
@ApiTags('users')
@Controller('users')
export class UsersController {
	constructor(public readonly usersService: UsersService) {}

	@ApiResponse({ status: 200, description: 'User details', type: UserGetResponse })
	@ApiResponse({ status: 400, description: 'Missing user uuid' })
	@ApiResponse({ status: 404, description: "User doesn't exist" })
	@Get(':uuid')
	@HttpCode(200)
	async get(@Param('uuid') uuid: string) {
		if (!uuid) {
			throw new BadRequestException();
		}
		return await this.usersService.get(uuid);
	}

	//TODO
	@ApiResponse({ status: 200, description: 'Not yet implemented' })
	@Patch(':uuid')
	@HttpCode(200)
	async update(@Param('uuid') uuid: string) {}

	//TODO
	@ApiResponse({ status: 200, description: 'Not yet implemented' })
	@Delete(':uuid')
	@HttpCode(200)
	async delete(@Param('uuid') uuid: string) {}
}
