import { UsersInfos } from 'src/users/users.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UsersTwofactorReq {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@ManyToOne((type) => UsersInfos, (user) => user.uuid, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	player: string;

	@Column({ nullable: true })
	secret: string;

	@Column({ nullable: true })
	token_hash: string;
}
