import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { TokensModule } from '../auth/tokens/tokens.module';
import { UsersModule } from '../users/users.module';

import { WsGateway } from './ws.gateway';

import { WsService } from './ws.service';

import { ChatsChannels } from '../chats/entities/channels.entity';

@Module({
	imports: [
		JwtModule,
		ConfigModule,
		forwardRef(() => UsersModule),
		forwardRef(() => TokensModule),
		TypeOrmModule.forFeature([ChatsChannels])
	],
	providers: [WsGateway, WsService],
	exports: [WsService]
})
export class WsModule {}
