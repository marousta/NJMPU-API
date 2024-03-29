import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsChannels } from './channels.entity';

@Entity()
export class ChatsMessages {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({ nullable: false })
	creation_date: Date;

	@Column({ nullable: true })
	message: string;

	/**
	 * Relation Message -> Users
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL',
		nullable: false,
	})
	user: string;

	/**
	 * Relation Message -> Channels
	 */
	@ManyToOne((type) => ChatsChannels, (channel) => channel.uuid, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	channel: string;
}
