import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';

import { UsersInfos } from '../../users/users.entity';

@Entity()
export class UsersTokens {
	@PrimaryColumn()
	id: number;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	user: string;

	@Column()
	creation_date: Date;

	@Column()
	platform: string;

	@Column({ nullable: true })
	access_token_hash: string;

	@Column({ nullable: true })
	refresh_token_hash: string;

	@Column({ nullable: true })
	ua_hash: string;

	@Column({ nullable: true })
	ip_hash: string;
}
