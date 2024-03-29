import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { readFileSync } from 'fs';

import { TokensModule } from '../auth/tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { GamesModule } from '../games/games.module';

import { WsGateway } from './ws.gateway';

import { WsService } from './ws.service';

import { ChatsChannels } from '../chats/entities/channels.entity';

@Module({
	imports: [
		ConfigModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => {
				const options: JwtModuleOptions = {
					privateKey: readFileSync(configService.get<string>('JWT_PRIVATE'), {
						encoding: 'utf8',
					}),
					publicKey: readFileSync(configService.get<string>('JWT_PUBLIC'), {
						encoding: 'utf8',
					}),
					signOptions: {
						algorithm: 'RS256',
					},
				};
				return options;
			},
			inject: [ConfigService],
		}),
		forwardRef(() => UsersModule),
		forwardRef(() => TokensModule),
		forwardRef(() => GamesModule),
		TypeOrmModule.forFeature([ChatsChannels]),
	],
	providers: [WsGateway, WsService],
	exports: [WsService],
})
export class WsModule {}
