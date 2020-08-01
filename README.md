# Xword

A collaborative crossword web app. This app allows users to make and 
join rooms in which they work together to solve a crossword.

## Notes
This is my first React app, so I know it's a bit dirty. It's also
my first multiplayer web app using Socket.io, so that's probably
a bit messy, too.

## Use
This app requires a server (in 
[src/app.js](https://github.com/cmhainje/xword/blob/master/src/App.js))
to run, but I'm not currently maintaining a server for it. You can run
it yourself, but this will involve installing all the corresponding
node modules and serving the server on a public port. More importantly,
though, the server address to which you need to connect will need to 
be specified in 
[src/index.js](https://github.com/cmhainje/xword/blob/master/src/App.js).
