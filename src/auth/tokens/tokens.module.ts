import { ConfigurableModuleBuilder, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TokensService } from './tokens.service';
import { UsersTokens } from './tokens.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UsersInfos } from '../../users/users.entity';

@Module({
	imports: [JwtModule, TypeOrmModule.forFeature([UsersInfos, UsersTokens]), JwtModule],
	providers: [TokensService, JwtService],
	exports: [TokensService]
})
export class TokensModule {}
