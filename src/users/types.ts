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
	Friends,
	Blocklist
}

export enum RelationDispatch {
	Add,
	Remove
}

export enum ApiResponseError {
	EmailTaken = 'Email already in use',
	AlreadyFriends = 'Already friends',
	AlreadyPending = 'Already sent a friend request',
	AlreadyBlocked = 'User already blocked',
	NotBlocked = 'User not blocked',
	FriendYourself = "You can't be friend with yourself",
	BlockYourself = "You can't block yourself",
	InteractYourself = "You can't interact with yourself",
	NotFound = "User doesn't exist",
	PasswordsIdentical = "Passwords can't be identical",
	PasswordMismatch = 'Password mismatch',
	ConfirmMismatch = 'New password mismatch confirmation input'
}
