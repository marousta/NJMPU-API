import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsChannels } from './channels.entity';

import { BlacklistType } from '../types';

@Entity()
export class ChatsChannelsBlacklist {
	@PrimaryGeneratedColumn('increment')
	id: number;

	@Column({
		type: 'enum',
		enum: BlacklistType
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
