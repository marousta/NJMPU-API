import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UsersInfos } from '../../users/users.entity';
import { ChannelType } from '../types';

@Entity()
export class ChatsChannels {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({
		type: 'enum',
		enum: ChannelType,
		default: ChannelType.Public
	})
	type: ChannelType;

	@Column()
	identifier: number;

	@Column()
	name: string;

	@Column({ nullable: true })
	password: string;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE'
	})
	moderator: UsersInfos;

	/**
	 * Relation Channel -> Users
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.channel, {
		nullable: false
	})
	@JoinTable()
	users: UsersInfos[];

	addUser(user: UsersInfos) {
		if (this.users === undefined) {
			this.users = new Array<UsersInfos>();
		}
		this.users.push(user);
	}
}
