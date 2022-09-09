import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WsModule } from '../websockets/ws.module';

import { ChannelsService } from './services/channels.service';
import { MessagesService } from './services/messages.service';

import { ChatsController } from './chats.controller';

import { ChatsChannels } from './entities/channels.entity';
import { ChatsMessages } from './entities/messages.entity';
import { UsersInfos } from '../users/users.entity';

@Module({
	imports: [TypeOrmModule.forFeature([ChatsChannels, ChatsMessages, UsersInfos]), WsModule],
	controllers: [ChatsController],
	providers: [ChannelsService, MessagesService]
})
export class ChatsModule {}
