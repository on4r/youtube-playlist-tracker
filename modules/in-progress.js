/**
 * Manages status of playlists being updated
 */

const PLAYLISTS = []

function any()
{
	return PLAYLISTS.length ? true : false
}

function playlist(id)
{
	return PLAYLISTS.includes(id)
}

function addPlaylist(id)
{
	return PLAYLISTS.push(id)
}

function removePlaylist(id)
{
	if (!this.playlist(id))
		return
	let i = PLAYLISTS.indexOf(id)
	return PLAYLISTS.splice(i, 1)
}

module.exports = {
	any,
	playlist,
	addPlaylist,
	removePlaylist
}
