import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { TokensService } from './tokens.service';
import { WsService } from '../../websockets/ws.service';

import { UsersTokens } from './tokens.entity';
import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsChannels } from '../../chats/entities/channels.entity';

@Module({
	imports: [JwtModule, TypeOrmModule.forFeature([UsersInfos, UsersTokens, ChatsChannels])],
	providers: [TokensService, JwtService, WsService],
	exports: [TokensService]
})
export class TokensModule {}
