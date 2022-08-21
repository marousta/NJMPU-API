import { Controller, UseGuards } from '@nestjs/common';
import { Crud, CrudController } from '@nestjsx/crud';

import { UsersInfos } from './users.entity';
import { UsersService } from './users.service';
import { AccessGuard } from '../auth/guards/access.guard';

@UseGuards(AccessGuard)
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
