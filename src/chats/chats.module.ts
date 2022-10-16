import { forwardRef, Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WsModule } from '../websockets/ws.module';

import { ChannelsService } from './services/channels.service';
import { ChannelsBlacklistService } from './services/channels.blacklist.service';
import { MessagesService } from './services/messages.service';

import { ChatsController } from './chats.controller';

import { ChatsChannels } from './entities/channels.entity';
import { ChatsMessages } from './entities/messages.entity';
import { ChatsChannelsBlacklist } from './entities/channels.blacklist.entity';
import { UsersInfos } from '../users/users.entity';
import { PicturesModule } from '../pictures/pictures.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ChatsChannels,
			ChatsMessages,
			ChatsChannelsBlacklist,
			UsersInfos
		]),
		WsModule
	],
	controllers: [ChatsController],
	providers: [ChannelsService, ChannelsBlacklistService, MessagesService],
	exports: [ChannelsService]
})
export class ChatsModule {}
