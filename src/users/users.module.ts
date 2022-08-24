import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';

import { UsersController } from './users.controller';

import { UsersService } from './users.service';
import { TokensService } from '../auth/tokens/tokens.service';

import { AccessStrategy } from '../auth/strategies/access.strategy';

import { UsersInfos } from './users.entity';
import { UsersTokens } from '../auth/tokens/tokens.entity';

@Module({
	imports: [TypeOrmModule.forFeature([UsersInfos, UsersTokens])],
	controllers: [UsersController],
	providers: [UsersService, ConfigService, AccessStrategy, TokensService, JwtService],
	exports: [UsersService]
})
export class UsersModule {}
