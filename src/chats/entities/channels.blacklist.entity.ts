import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsChannels } from './channels.entity';

import { BlacklistType } from '../types';

@Entity()
export class ChatsChannelsBlacklist {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({
		type: 'enum',
		enum: BlacklistType,
		nullable: true
	})
	type: BlacklistType;

	@Column({
		nullable: true
	})
	expiration: Date;

	/**
	 * Relation Channel blacklist -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	@JoinColumn()
	user: UsersInfos;

	/**
	 * Relation Channel blacklist -> Channel
	 */
	@ManyToOne((type) => ChatsChannels, (channel) => channel.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	@JoinColumn()
	channel: ChatsChannels;
}
