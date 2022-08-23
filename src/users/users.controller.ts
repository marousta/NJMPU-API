import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Crud, CrudController, CrudRequest, Override } from '@nestjsx/crud';
import { AuthGuard } from '@nestjs/passport';

import { UsersService } from './users.service';

import { UsersInfos } from './users.entity';

@UseGuards(AuthGuard('access'))
@Crud({
	model: {
		type: UsersInfos
	},
	params: {
		uuid: {
			field: 'uuid',
			type: 'uuid',
			primary: true
		}
	},
	routes: {
		exclude: ['createOneBase', 'createManyBase']
	}
})
@Controller('users')
export class UsersController implements CrudController<UsersInfos> {
	constructor(public service: UsersService) {}
}
