import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { LoginMethod } from '../types';

@Entity()
export class UsersInfos {
	@PrimaryGeneratedColumn('uuid')
	uuid: string;

	@Column()
	account_type: LoginMethod;

	@Column()
	identifier: number;

	@ApiProperty()
	@Column()
	username: string;

	@ApiProperty()
	@Column({ nullable: true })
	password: string;

	@ApiProperty()
	@Column({ nullable: true })
	profile_picture: string;

	@ApiProperty()
	@Column({ default: false })
	is_online: string;
}
