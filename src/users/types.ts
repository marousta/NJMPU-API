export enum UsersFriendship {
	False,
	True,
	Pending,
	Requested
}

export enum ApiResponseError {
	AlreadyFriends = 'Already friends',
	AlreadyPending = 'Already sended a friend request',
	FriendYourself = "You can't send a friend request to yourself",
	NotFound = "User doesn't exist"
}
