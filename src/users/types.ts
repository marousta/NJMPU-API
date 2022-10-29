export enum UsersFriendship {
	False,
	True,
	Pending,
	Requested
}

export enum NotifcationType {
	GameInvite,
	FriendRequest,
	AcceptedFriendRequest
}

export interface NotificationsCreateProperty {
	type: NotifcationType;
	notified_user: string;
	interact_w_user: string;
}

export enum ApiResponseError {
	EmailTaken = 'Email already in use',
	AlreadyFriends = 'Already friends',
	AlreadyPending = 'Already sended a friend request',
	FriendYourself = "You can't be friend with yourself",
	InteractYourself = "You can't interact with yourself",
	NotFound = "User doesn't exist",
	BadRequest = 'Bad request format',
	Confirmmismatch = 'New password mismatch confirmation input',
	PasswordsIdentical = "Passwords can't be identical",
	Passwordmismatch = 'Password mismatch'
}
