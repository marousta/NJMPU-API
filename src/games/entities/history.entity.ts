import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';

import { LobbyWinner } from '../types';

@Entity()
export class GamesHistory {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({
		type: 'enum',
		enum: LobbyWinner,
		nullable: false,
	})
	winner: LobbyWinner;

	@Column({
		nullable: false,
	})
	player1_score: number;

	@Column({
		nullable: false,
	})
	player2_score: number;

	@Column({
		nullable: false,
	})
	player1_xp: number;

	@Column({
		nullable: false,
	})
	player2_xp: number;

	@Column({
		nullable: false,
	})
	creation_date: Date;

	@Column({
		nullable: false,
	})
	matchmaking: boolean;

	/**
	 * Relation Game player1 -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	@JoinColumn()
	player1: UsersInfos;

	/**
	 * Relation Game player2 -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	@JoinColumn()
	player2: UsersInfos;
}
