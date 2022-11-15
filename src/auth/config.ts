export const hash_password_config = {
	timeCost: 11,
	saltLength: 128,
	parallelism: 4
};

export const hash_token_config = {
	timeCost: 5,
	saltLength: 128,
	parallelism: 4
};

export const verif_config = {
	parallelism: 4
};

export const token_time = {
	access: (new_date = new Date()) => new Date(new_date.valueOf() + 60 * 20 * 1000), // 20m
	refresh: (new_date = new Date()) => new Date(new_date.valueOf() + 60 * 60 * 24 * 3 * 1000), // 3d
	twofactor: (new_date = new Date()) => new Date(new_date.valueOf() + 60 * 4 * 1000) // 4m
};
