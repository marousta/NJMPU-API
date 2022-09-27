import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn
} from 'typeorm';
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

	/**
	 * Relation Channel administrator -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	administrator: string;

	/**
	 * Relation Channel moderators -> Users
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.moderator, {
		nullable: false
	})
	@JoinTable({
		name: 'chats_channels_moderators-users_infos'
	})
	moderators: UsersInfos[];

	addModerator(user: UsersInfos) {
		if (this.moderators === undefined) {
			this.moderators = new Array<UsersInfos>();
		}
		this.moderators.push(user);
	}

	/**
	 * Relation Channel -> Users
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.channel, {
		nullable: false
	})
	@JoinTable({
		name: 'chats_channels_users-users_infos'
	})
	users: UsersInfos[];

	addUser(user: UsersInfos) {
		if (this.users === undefined) {
			this.users = new Array<UsersInfos>();
		}
		this.users.push(user);
	}
}
