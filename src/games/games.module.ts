import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { WsModule } from '../websockets/ws.module';

import { GamesLobbyService } from './services/lobby.service';
import { GamesHistoryService } from './services/history.service';

import { GamesLobbyController } from './controllers/lobby.controller';
import { GamesHistoryController } from './controllers/history.controller';

import { GamesLobby } from './entities/lobby.entity';
import { GamesHistory } from './entities/history.entity';
import { UsersInfos } from '../users/entities/users.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([GamesLobby, GamesHistory, UsersInfos]),
		UsersModule,
		WsModule
	],
	controllers: [GamesLobbyController, GamesHistoryController],
	providers: [GamesLobbyService, GamesHistoryService],
	exports: [GamesLobbyService]
})
export class GamesModule {}
