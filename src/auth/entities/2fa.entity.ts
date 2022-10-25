import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersInfos } from '../../users/entities/users.entity';

@Entity()
export class UsersTwofactorReq {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user_uuid: string;

	@Column({ nullable: true })
	secret: string;

	@Column({ nullable: true })
	token_hash: string;

	@Column({ nullable: false })
	expiration: Date;
}

export interface UsersTwofactorReqID extends UsersTwofactorReq {
	user?: UsersInfos;
}
