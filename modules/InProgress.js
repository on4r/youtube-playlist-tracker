/**
 * Manages status of playlists being updated
 */
const InProgress = (() => {

	const PLAYLISTS = []

	function any() {
		return PLAYLISTS.length ? true : false
	}

	function playlist(id) {
		return PLAYLISTS.includes(id)
	}

	function addPlaylist(id) {
		return PLAYLISTS.push(id)
	}

	function removePlaylist(id) {
		if ( !this.playlist(id) )
			return
		let i = PLAYLISTS.indexOf(id)
		return PLAYLISTS.splice(i, 1)
	}

	return {
		any,
		playlist,
		addPlaylist,
		removePlaylist
	}

})()

module.exports = InProgress
