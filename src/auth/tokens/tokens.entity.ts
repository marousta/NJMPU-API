import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';

@Entity()
export class UsersTokens {
	@PrimaryColumn()
	uuid: string;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE',
		nullable: false
	})
	user_uuid: string;

	@Column({ nullable: false })
	creation_date: Date;

	@Column({ nullable: true })
	refresh_date: Date;

	@Column({ nullable: false })
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

export interface UsersTokensID extends UsersTokens {
	user?: UsersInfos;
}
