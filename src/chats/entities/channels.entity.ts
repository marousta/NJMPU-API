import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UsersInfos } from '../../users/users.entity';

@Entity()
export class ChatsChannels {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column()
	identifier: number;

	@Column()
	name: string;

	@Column({ nullable: true })
	password: string;

	/**
	 * Relation User -> Channels
	 */
	@OneToMany((type) => UsersInfos, (user) => user.channels, {
		onDelete: 'CASCADE',
		nullable: false
	})
	@JoinTable()
	user: UsersInfos;

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
