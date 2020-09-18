# Setup

add environment variables
> add trailing slash to base url

    YPT_APP_PORT=8080
    YPT_APP_BASE_URL=/some/url/path/

install packages 

    npm install

start server 

    node server.js

## lessons learned

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

### get latest release url from github

    curl -LIs -o /dev/null -w %{url_effective} https://github.com/ytdl-org/youtube-dl/releases/latest/
    => https://github.com/ytdl-org/youtube-dl/releases/tag/2020.09.14

    https://github.com/ytdl-org/youtube-dl/releases/download/2020.09.14/MD5SUMS
    https://github.com/ytdl-org/youtube-dl/releases/download/2020.09.14/youtube-dl

compare first line of *MD5SUM* (`cat MD5SUM | head -1`) with the binary

## einige playlist ids

    PL6cI1_8BvV-Yb9hCB_8AoFSAbF8gIyVVC
    PLowKtXNTBypH19whXTVoG3oKSuOcw_XeW
    PLjSy6F65_LKR-lJ8yxFDMivxdLZ3N59L4
    OLAK5uy_nAISRtNgeSDD0moO6yOou5WbDSf7E_QrI

## youtube-dl

### playlist format(s)

    https://www.youtube.com/playlist?list=<playlist_id>

### parse playlist and dump json to file

    youtube-dl --dump-single-json --flat-playlist <playlist_id> > playlist.json

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

