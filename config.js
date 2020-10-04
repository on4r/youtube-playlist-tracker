module.exports = {
	APP_ROOT: __dirname,
	APP_TITLE: process.env["YPT_APP_TITLE"] || "YouTube Playlist Tracker",
	APP_PORT: process.env["YPT_APP_PORT"] || 8080,
	APP_BASE_URL: process.env["YPT_APP_BASE_URL"] || "/",
	YOUTUBE_DL_PATH: process.env["YPT_YOUTUBE_DL_PATH"] || `${__dirname}/youtube-dl`,
	DATABASE_PATH: process.env["YPT_DATABASE_PATH"] || `${__dirname}/dev.sqlite`
}
