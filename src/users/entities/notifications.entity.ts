import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from './users.entity';
import { GamesLobby } from '../../games/entities/lobby.entity';

import { NotifcationType } from '../types';

@Entity()
export class UsersNotifications {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({
		type: 'enum',
		enum: NotifcationType
	})
	type: NotifcationType;

	@Column({ nullable: false })
	creation_date: Date;

	@Column({ nullable: false })
	read: boolean;

	/**
	 * Relation notifications -> Users
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	notified_user: string;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	interact_w_user: string;

	/**
	 * Relation notifications -> Games Lobby
	 */
	@ManyToOne((type) => GamesLobby, (lobby) => lobby.uuid, {
		onDelete: 'SET NULL',
		nullable: true
	})
	lobby: string;
}
