import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from './users.entity';

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

	@Column({ nullable: true })
	lobby: string;

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
}
