import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';
import { ChatsChannelsBlacklist } from './channels.blacklist.entity';

import { ChannelType } from '../types';

@Entity()
export class ChatsChannels {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({ nullable: false })
	default: boolean;

	@Column({
		type: 'enum',
		enum: ChannelType,
		nullable: false,
	})
	type: ChannelType;

	@Column({ nullable: false })
	identifier: number;

	@Column({ nullable: false })
	name: string;

	@Column({ nullable: true })
	password: string;

	@Column({ nullable: true })
	avatar: string;

	/**
	 * Relation Channel administrator -> User
	 */
	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	administrator: UsersInfos;

	/**
	 * Relation Channel moderators -> Users
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.moderator, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	@JoinTable({
		name: 'chats_channels_moderators-users_infos',
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
		onDelete: 'CASCADE',
		nullable: false,
	})
	@JoinTable({
		name: 'chats_channels_users-users_infos',
	})
	users: UsersInfos[];

	addUser(user: UsersInfos) {
		if (this.users === undefined) {
			this.users = new Array<UsersInfos>();
		}
		this.users.push(user);
	}

	/**
	 * Relation Channel -> Channel blacklist
	 */
	@OneToMany((type) => ChatsChannelsBlacklist, (entry) => entry.channel, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	@JoinTable({
		name: 'chats_channels-chats_channels_blacklist',
	})
	blacklist: ChatsChannelsBlacklist[];

	addBlacklist(entry: ChatsChannelsBlacklist) {
		if (this.blacklist === undefined) {
			this.blacklist = new Array<ChatsChannelsBlacklist>();
		}
		this.blacklist.push(entry);
	}
}

export interface ChatsChannelsID extends ChatsChannels {
	administratorID?: string;
	moderatorsID?: string[];
	usersID?: string[];
}
