import { CallHandler, Controller, ExecutionContext, Get, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { Crud, CrudController, CrudRequest, Override } from '@nestjsx/crud';
import { AuthGuard } from '@nestjs/passport';

import { UsersService } from './users.service';

import { UsersInfos } from './users.entity';
import { map } from 'rxjs';

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
@UseInterceptors(
	class temp {
		constructor() {}
		intercept(ctx: ExecutionContext, next: CallHandler) {
			return next.handle().pipe(
				map((data) => {
					return data.map((json) => {
						const { account_type, password, ...rest } = json;
						return rest;
					});
				})
			);
		}
	}
)
@Controller('users')
export class UsersController implements CrudController<UsersInfos> {
	constructor(public service: UsersService) {}
}
