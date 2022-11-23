import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { WsModule } from '../websockets/ws.module';

import { GamesLobbyService } from './services/lobby.service';
import { GamesHistoryService } from './services/history.service';
import { GamesMatchmakingService } from './services/matchmaking.service';

import { GamesLobbyController } from './controllers/lobby.controller';
import { GamesMatchmakingController } from './controllers/matchmaking.controller';
import { GamesHistoryController } from './controllers/history.controller';

import { GamesHistory } from './entities/history.entity';
import { UsersInfos } from '../users/entities/users.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([GamesHistory, UsersInfos]),
		forwardRef(() => UsersModule),
		forwardRef(() => WsModule),
	],
	controllers: [GamesLobbyController, GamesMatchmakingController, GamesHistoryController],
	providers: [GamesLobbyService, GamesHistoryService, GamesMatchmakingService],
	exports: [GamesLobbyService, GamesMatchmakingService],
})
export class GamesModule {}
