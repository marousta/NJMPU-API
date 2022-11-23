import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ChatsChannels } from '../../chats/entities/channels.entity';
import { GamesHistory } from '../../games/entities/history.entity';

import { UserStatus } from '../types';

@Entity()
export class UsersInfos {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column({ nullable: false })
	adam: boolean;

	@Column({ nullable: false })
	identifier: number;

	@Column({ nullable: false })
	username: string;

	@Column({ unique: true })
	email: string;

	@Column({ nullable: true })
	password: string;

	@Column({ nullable: true })
	twofactor: string;

	@Column({ nullable: true })
	avatar: string;

	@Column({
		type: 'enum',
		enum: UserStatus,
		nullable: false,
	})
	is_online: UserStatus;

	/**
	 * Relation Channel moderators -> Users
	 */
	@OneToMany((type) => ChatsChannels, (channel) => channel.moderators, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	@JoinTable({
		name: 'chats_channels_moderators-users_infos',
	})
	moderator: ChatsChannels;

	/**
	 * Relation Channel -> Users
	 */
	@OneToMany((type) => ChatsChannels, (channel) => channel.users, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	channel: ChatsChannels;

	/**
	 * Relation user -> friends
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	@JoinTable({
		name: 'users_infos_friends',
	})
	friends: UsersInfos[];

	addFriends(user: UsersInfos) {
		if (this.friends === undefined) {
			this.friends = new Array<UsersInfos>();
		}
		this.friends.push(user);
	}

	/**
	 * Relation user -> blocklist
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	@JoinTable({
		name: 'users_infos_blocklist',
	})
	blocklist: UsersInfos[];

	addBlocklist(user: UsersInfos) {
		if (this.blocklist === undefined) {
			this.blocklist = new Array<UsersInfos>();
		}
		this.blocklist.push(user);
	}

	/**
	 * Relation Games Lobby -> Users
	 */
	@OneToMany((type) => GamesHistory, (channel) => channel.player1, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	player1_history: GamesHistory;

	/**
	 * Relation Games Lobby -> Users
	 */
	@OneToMany((type) => GamesHistory, (channel) => channel.player2, {
		onDelete: 'CASCADE',
		nullable: false,
	})
	player2_history: GamesHistory;
}
