import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WsGateway } from './ws.gateway';

import { WsService } from './ws.service';

import { ChatsChannels } from '../chats/entities/channels.entity';

@Module({
	imports: [TypeOrmModule.forFeature([ChatsChannels])],
	providers: [WsGateway, WsService],
	exports: [WsService]
})
export class WsModule {}
