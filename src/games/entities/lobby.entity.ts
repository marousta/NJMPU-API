import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn
} from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';

import { LobbyPlayerReadyState } from '../types';

@Entity()
export class GamesLobby {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({ nullable: false })
	in_game: boolean;

	@Column({
		type: 'enum',
		enum: LobbyPlayerReadyState,
		nullable: false
	})
	player1_status: LobbyPlayerReadyState;

	@Column({
		type: 'enum',
		enum: LobbyPlayerReadyState,
		nullable: false
	})
	player2_status: LobbyPlayerReadyState;

	/**
	 * Relation Game player1 -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	@JoinColumn()
	player1: UsersInfos;

	/**
	 * Relation Game player2 -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL',
		nullable: true
	})
	@JoinColumn()
	player2: UsersInfos;

	/**
	 * Relation Games lobby -> Users
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinTable({
		name: 'games_lobby_spectators-users_infos'
	})
	spectators: UsersInfos[];

	addSpectator(user: UsersInfos) {
		if (this.spectators === undefined) {
			this.spectators = new Array<UsersInfos>();
		}
		this.spectators.push(user);
	}
}

export interface GamesLobbyFinished extends GamesLobby {
	winner: number;
	player1_score: number;
	player2_score: number;
}
