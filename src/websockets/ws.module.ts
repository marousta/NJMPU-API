import { Module } from '@nestjs/common';

import { WsGateway } from './ws.gateway';

import { WsService } from './ws.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersInfos } from '../users/users.entity';

@Module({
	imports: [TypeOrmModule.forFeature([UsersInfos])],
	providers: [WsGateway, WsService],
	exports: [WsService]
})
export class WsModule {}
