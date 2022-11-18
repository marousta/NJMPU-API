import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { UsersModule } from '../../users/users.module';
import { WsModule } from '../../websockets/ws.module';

import { TokensService } from './tokens.service';

import { UsersTokens } from './tokens.entity';

@Module({
	imports: [
		JwtModule,
		TypeOrmModule.forFeature([UsersTokens]),
		forwardRef(() => WsModule),
		forwardRef(() => UsersModule)
	],
	providers: [TokensService, JwtService],
	exports: [TokensService]
})
export class TokensModule {}
