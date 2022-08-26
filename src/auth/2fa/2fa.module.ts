import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TwoFactorService } from './2fa.service';

import { UsersTwofactorReq } from './2fa.entity';
import { UsersInfos } from '../../users/users.entity';

@Module({
	imports: [ConfigModule, JwtModule, TypeOrmModule.forFeature([UsersTwofactorReq, UsersInfos])],
	providers: [TwoFactorService, JwtService, ConfigService],
	exports: [TwoFactorService]
})
export class TwoFactorModule {}
