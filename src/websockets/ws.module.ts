import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WsGateway } from './ws.gateway';

import { WsService } from './ws.service';

import { ChatsChannels } from '../chats/entities/channels.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TokensModule } from '../auth/tokens/tokens.module';

@Module({
	imports: [JwtModule, ConfigModule, TokensModule, TypeOrmModule.forFeature([ChatsChannels])],
	providers: [WsGateway, WsService],
	exports: [WsService]
})
export class WsModule {}
