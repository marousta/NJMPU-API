import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ChatsChannels } from '../../chats/entities/channels.entity';

@Entity()
export class UsersInfos {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column()
	identifier: number;

	@Column()
	username: string;

	@Column({ unique: true })
	email: string;

	@Column({ nullable: true })
	password: string;

	@Column({ nullable: true })
	twofactor: string;

	@Column({ nullable: true })
	avatar: string;

	@Column({ default: false })
	is_online: boolean;

	/**
	 * Relation Channel moderators -> Users
	 */
	@OneToMany((type) => ChatsChannels, (channel) => channel.moderators, {
		onDelete: 'CASCADE',
		nullable: false
	})
	@JoinTable({
		name: 'chats_channels_moderators-users_infos'
	})
	moderator: ChatsChannels;

	/**
	 * Relation Channel -> Users
	 */
	@OneToMany((type) => ChatsChannels, (channel) => channel.users, {
		onDelete: 'CASCADE',
		nullable: false
	})
	channel: ChatsChannels;

	/**
	 * Relation user -> friends
	 */
	@ManyToMany((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinTable({
		name: 'users_infos_friends'
	})
	friends: UsersInfos[];

	addFriends(user: UsersInfos) {
		if (this.friends === undefined) {
			this.friends = new Array<UsersInfos>();
		}
		this.friends.push(user);
	}
}

export interface UsersInfosID extends UsersInfos {
	friendsID?: string[];
}
