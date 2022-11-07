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

export enum RelationType {
	friends,
	blocklist
}

export enum RelationDispatch {
	add,
	remove
}

export enum ApiResponseError {
	EmailTaken = 'Email already in use',
	AlreadyFriends = 'Already friends',
	AlreadyPending = 'Already sended a friend request',
	AlreadyBlocked = 'User already blocked',
	NotBlocked = 'User not blocked',
	FriendYourself = "You can't be friend with yourself",
	BlockYourself = "You can't block yourself",
	InteractYourself = "You can't interact with yourself",
	NotFound = "User doesn't exist",
	BadRequest = 'Bad request format',
	ConfirmMismatch = 'New password mismatch confirmation input',
	PasswordsIdentical = "Passwords can't be identical",
	Passwordmismatch = 'Password mismatch',
	MissingParameters = 'Invalid or missing parameters'
}
