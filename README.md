# lessons learned

1. `ls -X` sorts by filetype 
2. *sqlite3* is limited in how many variables you can pass the query (search `SQLITE_MAX_VARIABLE_NUMBER`)
3. Access script arguments in your node app via `process.argv` (the first two are *node* and *filepath*
4. Javascript has something called [labeled statements](!https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label)
  This can be used to `break` from `try..catch` block!
5. Add charset meta tag: `<meta charset="utf-8">`
6. Add stylesheet in head `<link rel="stylesheet" href="styles.css">`
7. Javascript has in the latest spec `Promise.allSettled` which only resolves (with all values) after all passed Promises are finished

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

