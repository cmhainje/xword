var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

var sockets = [];
var boardValues = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.id = getNewId();
  socket.color = getNewColor();
  socket.emit('id', socket.id);
  socket.emit('color', socket.color);

  if (boardValues.length !== 0)
    socket.emit('valueUpdate', boardValues);

  for (var i = 0; i < sockets.length; i++) {
    if (sockets[i].id !== socket.id) {
      socket.emit('newFriend', [sockets[i].id, sockets[i].color]);
      if (sockets[i].row !== undefined) {
        socket.emit('selectUpdate', [sockets[i].row, sockets[i].col, sockets[i].id]);
      }
    }
  }
  sockets.push(socket);

  socket.broadcast.emit('newFriend', [socket.id, socket.color]);

  // NOTE: It might be expensive to pass the entire array of values
  // Change to only pass row, col, newValue if it's a problem
  socket.on('updateValue', (newValues) => {
    boardValues = newValues;
    socket.broadcast.emit('valueUpdate', newValues);
  });

  socket.on('updateSelect', (data) => {
    const [row, col] = data;
    socket.row = row; socket.col = col;
    socket.broadcast.emit('selectUpdate', [row, col, socket.id])
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');

    // Remove this socket from the array
    var newSockets = [];
    for (var i = 0; i < sockets.length; i++) {
      if (sockets[i].id !== socket.id) {
        newSockets.push(sockets[i]);
      }
    }
    sockets = newSockets;
    socket.broadcast.emit('byeFriend', socket.id);
  });
});

http.listen(8000, () => {
  console.log('Listening on *:8000.');
});


colors = [
  '#EEB9B9',
  '#EED7B9',
  '#EEECB9',
  '#E0EEB9',
  '#C4EEB9',
  '#B9EED8',
  '#B9EEEA',
  '#B9D3EE',
  '#B9BAEE',
  '#D0B9EE',
  '#E9B9EE'
];

function getNewColor() {
  var newColor = colors.pop();
  if (newColor === undefined) {
    colors = [
      '#EEB9B9',
      '#EED7B9',
      '#EEECB9',
      '#E0EEB9',
      '#C4EEB9',
      '#B9EED8',
      '#B9EEEA',
      '#B9D3EE',
      '#B9BAEE',
      '#D0B9EE',
      '#E9B9EE'
    ];
    newColor = colors.pop();
  }
  shuffle(colors);
  return newColor;
}


function getNewId() {
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}
