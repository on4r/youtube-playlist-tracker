# YouTube Playlist Tracker
> recover deleted video titles

If YouTube would just show the titles of deleted videos i wouldn't had to create this app!

- *sqlite* database
- *youtube-dl* to parse playlists (no API-key needed)
- *node* and *express* powered server
- *ejs* frontend templates

## Setup

Add environment variables

    YPT_APP_TITLE="App Title"
    YPT_APP_PORT=8080
    YPT_APP_BASE_URL=/some/url/path/ # <- add trailing slash
    YPT_YOUTUBE_DL_PATH=/path/to/youtube-dl
    YPT_DATABASE_PATH=/path/to/db.sqlite

Install packages 

    npm install

Start server 

    node server.js

## Lessons learned

1. `ls -X` sorts by filetype 
2. *sqlite3* is limited in how many variables you can pass the query (search `SQLITE_MAX_VARIABLE_NUMBER`)
3. Access script arguments in your node app via `process.argv` (the first two are *node* and *filepath*
4. Javascript has something called [labeled statements](!https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label)
  This can be used to `break` from `try..catch` block!
5. Add charset meta tag: `<meta charset="utf-8">`
6. Add stylesheet in head `<link rel="stylesheet" href="styles.css">`
7. Javascript has in the latest spec `Promise.allSettled` which only resolves (with all values) after all passed Promises are finished
8. In *vim* `Ctrl-O` jumps to the last cursor position after a move command. 
  And `*` jumps to the next occurrence of whatever word is below the cursor. 
  To manipulate folds use `zO`,`zC`,`zA`,`zR`,`zM` (the last two manipulate all folds in the file)
9. *express*: always `return` after `res.send`, `res.render`, etc. whatever... save yourself some nerves :D
10. always make sure to call *views*, *scripts*, etc. with the **absolute** path on the system using `__dirname`.
  Because your node app will be called from a supervisor process from a different directory. so check your *paths*.
11. **ALWAYS** use opening and closing brackets when writing `if..else`. You **will** add some lines later on and then you have to add them anyways.
12. There exists something called `N-API` which serves as an interface for low level programms written in `C/C++`. [Read more](https://medium.com/jspoint/a-simple-guide-to-load-c-c-code-into-node-js-javascript-applications-3fcccf54fd32)

## youtube-dl

### parse playlist and dump json to file

    youtube-dl --dump-single-json --flat-playlist <playlist_id> > playlist.json

playlist.json

    {
        "_type": "playlist",
        "entries": [
            {"_type": "url", "url": "uv98Gf_HHRQ", "ie_key": "Youtube", "id": "uv98Gf_HHRQ", "title": "Sokrates - Ahnherr der Philosophen"},
            {"_type": "url", "url": "v4KJt3LgaOg", "ie_key": "Youtube", "id": "v4KJt3LgaOg", "title": "Seneca - Das Leben ist kurz"},
            {"_type": "url", "url": "ltty-_xLMwE", "ie_key": "Youtube", "id": "ltty-_xLMwE", "title": "Platon   Ein Gastmahl der Liebe"},
            {"_type": "url", "url": "9qar-dVOUNE", "ie_key": "Youtube", "id": "9qar-dVOUNE", "title": "Hypatia - Eine au\u00dfergew\u00f6hnliche Philosophin"},
            {"_type": "url", "url": "oKVCFrt-TY4", "ie_key": "Youtube", "id": "oKVCFrt-TY4", "title": "Heraklit - Das Weltbild des antiken Denkers"},
            {"_type": "url", "url": "nDQ_L0RmYaw", "ie_key": "Youtube", "id": "nDQ_L0RmYaw", "title": "Diogenes   Lebensphilosoph und Provokateur"},
            {"_type": "url", "url": "JAjTXKMGXpE", "ie_key": "Youtube", "id": "JAjTXKMGXpE", "title": "Zenophon - Die Lebenskunst der Stoa"}
        ],
        "id": "PL6cI1_8BvV-Yb9hCB_8AoFSAbF8gIyVVC",
        "title": "Philosophie der Antike",
        "uploader": "Philosophie",
        "uploader_id": "UCt4EMbT6U53314MvMRUpFnw",
        "uploader_url": "https://www.youtube.com/channel/UCt4EMbT6U53314MvMRUpFnw",
        "extractor": "youtube:playlist",
        "webpage_url": "PL6cI1_8BvV-Yb9hCB_8AoFSAbF8gIyVVC",
        "webpage_url_basename": "PL6cI1_8BvV-Yb9hCB_8AoFSAbF8gIyVVC",
        "extractor_key": "YoutubePlaylist"
    }

### errors

playlist is private

    err: { Error: Command failed: youtube-dl --dump-single-json --flat-playlist PLKBVIiQPPtyi_6r4buI4ZsiW39eBsjjXl
    ERROR: This playlist is private, use --username or --netrc to access it.

        at ChildProcess.exithandler (child_process.js:273:12)
        at ChildProcess.emit (events.js:180:13)
        at maybeClose (internal/child_process.js:936:16)
        at Process.ChildProcess._handle.onexit (internal/child_process.js:220:5)
        killed: false,
        code: 1,
        signal: null,
        cmd: 'youtube-dl --dump-single-json --flat-playlist PLKBVIiQPPtyi_6r4buI4ZsiW39eBsjjXl' }
    stderr: ERROR: This playlist is private, use --username or --netrc to access it.
    undefined:1

