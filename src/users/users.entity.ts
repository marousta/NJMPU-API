import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
	is_online: string;
}
