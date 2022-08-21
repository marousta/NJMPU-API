import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class UsersInfos {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@ApiProperty()
	@Column({ unique: true })
	username: string;

	@ApiProperty()
	@Column()
	password: string;

	@ApiProperty()
	@Column({ nullable: true })
	profile_picture: string;

	@ApiProperty()
	@Column({ default: false })
	is_online: string;
}
