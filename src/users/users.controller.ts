import {
	CallHandler,
	Controller,
	ExecutionContext,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Crud, CrudController } from '@nestjsx/crud';
import { AuthGuard } from '@nestjs/passport';
import { map } from 'rxjs';

import { UsersService } from './users.service';

import { UsersInfos } from './users.entity';

@UseGuards(AuthGuard('access'))
@ApiTags('users')
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
						const { account_type, password, twofactor, ...rest } = json;
						return { ...rest, twofactor: json.twofactor ? true : false };
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
