var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);


roomCodes = [];
function roomExists(roomCode) {
  for (var i = 0; i < roomCodes.length; i++) {
    if (roomCode === roomCodes[i]) {
      return true;
    }
  }
  return false;
}

io.on('connection', (socket) => {
  console.log('New connection: ' + socket.id);
  socket.emit('connected!');
  socket.emit('id', socket.id);

  // user will send desired name and color
  socket.on('userInfo', ([name, color]) => {
    socket.name = name;
    socket.color = color;
  });

  // user will ask to either make a room or join a room
  socket.on('makeRoom', ([roomCode, puzzleID]) => {
    if (roomExists(roomCode)) {
      socket.emit('cantMakeRoom');
      return;
    }

    roomCodes.push(roomCode);
    socket.join(roomCode);
    socket.room = roomCode;
    socket.emit('madeRoom');
  });

  socket.on('joinRoom', (roomCode) => {
    if (!roomExists(roomCode)) {
      socket.emit('cantJoinRoom');
      return;
    }

    socket.room = roomCode;
    socket.join(roomCode);
    socket.to(roomCode).emit('requestStatus', socket.id);
    socket.to(roomCode).emit('newFriend', [socket.id, socket.color, socket.name]);
  });

  socket.on('currentStatus',
    (data) => {
      socket.to(data.requestor).emit('status', data);
    }
  );

  socket.on('updateValue', (values) => {
    socket.to(socket.room).emit('valueUpdate', (values));
  });

  socket.on('updateSelect', ([row, col]) => {
    socket.to(socket.room).emit('selectUpdate', [row, col, socket.id]);
  });

  socket.on('disconnect', () => {
    // sockets leave rooms on disconnect
    socket.to(socket.room).emit('goodbye', socket.id);
    console.log('Disconnection: ' + socket.id)

    if (io.sockets.adapter.rooms[socket.room] === undefined) {
      const newRoomsList = [];
      for (var i = 0; i < roomCodes.length; i++) {
        if (roomCodes[i] !== socket.room) {
          newRoomsList.push(roomCodes[i]);
        }
      }
      roomCodes = newRoomsList;
    }
  });
});

http.listen(8000, () => {
  console.log('Listening on port 8000.');
});
