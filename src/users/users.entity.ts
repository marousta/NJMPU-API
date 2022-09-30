import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinTable, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ChatsChannels } from '../chats/entities/channels.entity';

@Entity()
export class UsersInfos {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column()
	identifier: number;

	@ApiProperty()
	@Column()
	username: string;

	@ApiProperty()
	@Column({ unique: true })
	email: string;

	@ApiProperty()
	@Column({ nullable: true })
	password: string;

	@Column({ nullable: true })
	twofactor: string;

	@ApiProperty()
	@Column({ nullable: true })
	profile_picture: string;

	@ApiProperty()
	@Column({ default: false })
	is_online: boolean;

	/**
	 * Relation Channel moderators -> Users
	 */
	@OneToMany((type) => ChatsChannels, (channel) => channel.moderators, {
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
		nullable: false
	})
	channel: ChatsChannels;
}
