import React from 'react';
import ReactDOM from 'react-dom';
import io from 'socket.io-client';
import $ from 'jquery';

import './game.css';
import './home.css';


// ====
// PUZZLE LOADING HELPERS
function getClueNumbers(puzzleData) {
  var clueNumbers = []
  var clueCount = 1;

  function isClueSquare(i, j) {
    if (puzzleData.puzzleSquares[i][j] !== 1) {
      return (
        i === 0 || j === 0 ||
        puzzleData.puzzleSquares[i-1][j] === 1 ||
        puzzleData.puzzleSquares[i][j-1] === 1
      );
    }
    else
      return false;
  }

  for (var i = 0; i < puzzleData.puzzleSquares.length; i++) {
    const row = [];
    for (var j = 0; j < puzzleData.puzzleSquares.length; j++) {
      if (isClueSquare(i, j))
        row.push(clueCount++);
      else
        row.push(0);
    }
    clueNumbers.push(row);
  }
  return clueNumbers;
}

function makeClueToCoordsMap(n, clueNumbers) {
  let map = new Map();
  for (var i = 0; i < n; i++) {
    for (var j = 0; j < n; j++) {
      if (clueNumbers[i][j] !== 0) {
        map.set(clueNumbers[i][j], {"row": i, "col": j})
      }
    }
  }
  return map;
}

function makeClueArray(n, clueNumbers, puzzleData, across) {
  var clues = []
  var current = 0
  var i, j;

  if (across) {
    for (i = 0; i < n; i++) {
      const row = [];
      for (j = 0; j < n; j++) {
        if (puzzleData.puzzleSquares[i][j] === 1) {
          row.push(0);
        } else {
          if (j === 0 || puzzleData.puzzleSquares[i][j-1] === 1) {
            current = clueNumbers[i][j];
          }
          row.push(current);
        }
      }
      clues.push(row);
    }
  }
  else {
    var clues_T = [];
    for (j = 0; j < n; j++) {
      const col = [];
      for (i = 0; i < n; i++) {
        if (puzzleData.puzzleSquares[i][j] === 1) {
          col.push(0);
        } else {
          if (i === 0 || puzzleData.puzzleSquares[i-1][j] === 1) {
            current = clueNumbers[i][j];
          }
          col.push(current);
        }
      }
      clues_T.push(col);
    }

    for (i = 0; i < n; i++) {
      const row = [];
      for (j = 0; j < n; j++) {
        row.push(clues_T[j][i]);
      }
      clues.push(row);
    }
  }

  return clues;
}

var USER_COLOR = '#EED7B9';
const CLUE_COLOR = '#EEEEEE';


// ====
// CONNECT TO SERVER
// const socket = openSocket('http://208.64.170.251:8000');
// const socket = openSocket('http://localhost:8000');
// const socket = openSocket('http://xword-server.herokuapp.com/:8000');

const socket = io('https://x-word.herokuapp.com');
socket.on('id', (id) => {
  socket.id = id;
})

socket.friendsColors = new Map();
socket.friendsNames = new Map();
socket.on('newFriend', (data) => {
  if (data[0] === socket.name) return;
  socket.friendsColors.set(data[0], data[1]);
  socket.friendsNames.set(data[0], data[2]);
});



// ====
// REACT UI
class Square extends React.Component {
  render() {
    return (
      <div
        className="square"
        style={ { backgroundColor: this.props.color } }
        onClick={() => {this.props.handleClick();}}
      >
        <div className="clue-number"> {this.props.clue === 0 ? "" : this.props.clue} </div>
        {this.props.value}
      </div>
    );
  }
}


class Board extends React.Component {
  renderSquare(row, col) {
    if (this.props.puzzle.squares[row][col] === 0) {
      return <Square
        key={[row, col]}
        clue={this.props.puzzle.clueNumbers[row][col]}
        value={this.props.squareValues[row][col]}
        color={this.props.squareColors[row][col]}

        handleClick={() => {this.props.handleClick(row, col);}}
      />;
    }
    else {
      return <div className="blocked-square" key={[row, col]}></div>;
    }
  }

  render() {
    const items = [];
    for (var i = 0; i < this.props.puzzle.n; i++) {
      const row = [];
      for (var j = 0; j < this.props.puzzle.n; j++)
        row.push(this.renderSquare(i, j));
      items.push(<div className="row" key={i} >{row}</div>)
    }
    return (<div>{items}</div>);
  }
}


class Clues extends React.Component {
  renderClue(number, text) {
    return (
      <li
        className="clue"
        key={number}
        onClick={() => this.props.handleClick(number)}
        style={ (this.props.selectedClue == number) ? { backgroundColor: CLUE_COLOR } : { backgroundColor: "white" } }
      >
        {number}: {text}
      </li>
    );
  }

  render() {
    const items = [];
    for (let clue of this.props.clues) {
      items.push(this.renderClue(clue.number, clue.clue));
    }
    return (
      <div className="clues">
        <ul>
          {items}
        </ul>
      </div>
    );
  }
}


class Game extends React.Component {
  constructor(props) {
    super(props);

    this.emptyBoard = [];
    for (var i = 0; i < this.props.puzzle.n; i++) {
      const row = [];
      for (var j = 0; j < this.props.puzzle.n; j++)
        row.push(0);
      this.emptyBoard.push(row);
    }

    if (this.props.boardStatus === undefined) {
      this.state = {
        squareValues: this.newEmptyBoard(""),
        squareColors: this.newEmptyBoard("#FFFFFF"),
      };
    }
    else {
      this.state = {
        squareValues: this.props.boardStatus,
        squareColors: this.newEmptyBoard("#FFFFFF"),
      };
    }

    if (this.props.friendsCells === undefined) {
      this.friendsCells = [];
      this.friendMask = this.newEmptyBoard("");
    }
    else {
      this.friendsCells = this.props.friendsCells;
      this.friendMask = this.newEmptyBoard("");
      this.remakeFriendMask();
      this.state.squareColors = this.friendMask;
    }

    this.selectedCell = {"row": -1, "col": -1};
    this.selectMask = this.newEmptyBoard(false);

    this.selectedClue = {"number": 0, "across": true};
    this.clueMask = this.newEmptyBoard(false);


    // Event listeners for keypresses
    document.addEventListener("keydown", (event) => {
      var key = event.key;
      if (key === "ArrowDown" || key === "ArrowUp" || key === "ArrowLeft" || key === "ArrowRight")
        this.handleArrowKeyPress(key);
      else if (key === "Backspace")
        this.handleBackspacePress();
      else if (key.length === 1)
        this.handleKeyPress(key);
    });


    // Server listeners for updates
    if (socket !== undefined) {
      socket.on('valueUpdate', (newValues) => {
        this.setState((prevState, props) => {
          return {
            squareValues: newValues,
            squareColors: prevState.squareColors,
          };
        });
      });

      socket.on('selectUpdate', (data) => {
        const [row, col, id] = data;
        var found = false;
        for (i = 0; i < this.friendsCells.length; i++) {
          if (this.friendsCells[i].id === id) {
            found = true;
            this.friendsCells[i] = {"row": row, "col": col, "id": id};
            break;
          }
        }
        if (!found) {
          this.friendsCells.push({"row": row, "col": col, "id": id});
        }

        this.remakeFriendMask();
        this.updateColors();
      });

      socket.on('requestStatus', (id) => {
        console.log('status requested by ' + id);

        const friendsCells = this.friendsCells;
        if (this.selectedCell.row !== -1) {
          friendsCells.push({
            "row": this.selectedCell.row,
            "col": this.selectedCell.col,
            "id":  socket.id
          });
        }

        var friendsColors = new Map(socket.friendsColors);
        friendsColors.set(socket.id, socket.color);

        var friendsNames = new Map(socket.friendsNames);
        friendsNames.set(socket.id, socket.name);

        socket.emit('currentStatus', ( {
          "puzzleID": this.props.puzzle.id,
          "boardStatus": this.props.squareValues,
          "friendsCells": friendsCells,
          "friendsColors": Array.from(friendsColors.entries()),
          "friendsNames": Array.from(friendsNames.entries()),
          "requestor": id
        }));
      });

      socket.on('goodbye', (id) => {
        socket.friendsColors.delete(id);
        socket.friendsNames.delete(id);
        var newFriendsCells = [];
        for (i = 0; i < this.friendsCells.length; i++) {
          if (this.friendsCells[i].id !== id) {
            newFriendsCells.push(this.friendsCells[i]);
          }
        }
        this.friendsCells = newFriendsCells;
        this.remakeFriendMask();
        this.updateColors();
      });
    }
  }

  remakeFriendMask() {
    var newFriendMask = this.newEmptyBoard("");
    for (var i = this.friendsCells.length - 1; i >= 0; i--) {
      const row = this.friendsCells[i].row;
      const col = this.friendsCells[i].col;
      if (row === -1 || col === -1) { continue; }
      const color = socket.friendsColors.get(this.friendsCells[i].id);

      newFriendMask[row][col] = color;
    }
    this.friendMask = newFriendMask;
  }

  updateValue(row, col, newValue) {
    if (this.selectedCell.row === -1) { return; }
    var newValues = this.state.squareValues.map(x => x);
    newValues[row][col] = newValue;

    this.setState(
      (prevState, props) => {
        return {
          squareValues: newValues,
          squareColors: prevState.squareColors,
        };
      },
      () => { socket.emit('updateValue', newValues); }
    );
  }

  handleKeyPress(key) {
    if (key.toUpperCase() == key.toLowerCase())
      return;

    const row = this.selectedCell.row;
    const col = this.selectedCell.col;
    this.updateValue(row, col, key.toUpperCase());

    // If in the selected clue, move selected cell forward along the clue direction
    if (this.selectedClue.number !== 0 && this.clueMask[row][col]) {
      if (this.selectedClue.across && col + 1 < this.props.puzzle.n && this.props.puzzle.squares[row][col+1] !== 1)
        this.updateSelectedCell(row, col + 1);
      else if (!this.selectedClue.across && row + 1 < this.props.puzzle.n && this.props.puzzle.squares[row+1][col] !== 1)
        this.updateSelectedCell(row + 1, col);
    }
  }

  handleBackspacePress() {
    const row = this.selectedCell.row;
    const col = this.selectedCell.col;
    this.updateValue(row, col, "");

    // If in the selected clue, move selected cell backward along the clue direction
    if (this.selectedClue.number !== 0 && this.clueMask[row][col]) {
      if (this.selectedClue.across && col - 1 >= 0 && this.props.puzzle.squares[row][col-1] !== 1)
        this.updateSelectedCell(row, col - 1);
      else if (!this.selectedClue.across && row - 1 >= 0 && this.props.puzzle.squares[row-1][col] !== 1)
        this.updateSelectedCell(row - 1, col);
    }
  }

  updateColors() {
    this.setState(
      (prevState, props) => {
        var newColors = this.newEmptyBoard("#FFFFFF")

        // Apply clue, friends, and select masks
        for (var i = 0; i < this.props.puzzle.n; i++) {
          for (var j = 0; j < this.props.puzzle.n; j++) {
            if (this.selectMask[i][j])
              newColors[i][j] = USER_COLOR;
            else if (this.friendMask[i][j] !== "")
              newColors[i][j] = this.friendMask[i][j];
            else if (this.clueMask[i][j])
              newColors[i][j] = CLUE_COLOR;
          }
        }

        return {
          squareValues: prevState.squareValues,
          squareColors: newColors,
        };
      }
    );
  }

  updateSelectedCell(row, col) {
    if (row === this.selectedCell.row && col === this.selectedCell.col)
      return;

    var newSelectMask = this.newEmptyBoard(false);
    newSelectMask[row][col] = true;

    this.selectedCell = {"row": row, "col": col}
    this.selectMask = newSelectMask;

    this.updateColors();

    socket.emit('updateSelect', [row, col]);
  }

  handleClick(row, col) {
    // if they clicked on the selected cell, flip across/down
    if (row === this.selectedCell.row && col == this.selectedCell.col) {
      if (this.selectedClue.across) {
        const newNum = this.props.puzzle.clueDownArray[row][col];
        this.updateSelectedClue(newNum, !this.selectedClue.across);
      } else {
        const newNum = this.props.puzzle.clueAcrossArray[row][col];
        this.updateSelectedClue(newNum, !this.selectedClue.across);
      }
    }

    // if they clicked outside the current clue, update clue
    else if (!this.clueMask[row][col]){
      if (this.selectedClue.across) {
        const newNum = this.props.puzzle.clueAcrossArray[row][col];
        this.updateSelectedClue(newNum, this.selectedClue.across);
      } else {
        const newNum = this.props.puzzle.clueDownArray[row][col];
        this.updateSelectedClue(newNum, this.selectedClue.across);
      }
    }

    this.updateSelectedCell(row, col);
  }

  handleArrowKeyPress(key) {

    if (this.selectedCell.row === -1) { return; }

    const oldRow = this.selectedCell.row;
    const oldCol = this.selectedCell.col;
    var newRow, newCol;

    switch (key) {
      case "ArrowLeft": // left arrow
        newRow = oldRow;
        newCol = (oldCol - 1 + this.props.puzzle.n) % this.props.puzzle.n;
        break;
      case "ArrowUp": // up arrow
        newRow = (oldRow - 1 + this.props.puzzle.n) % this.props.puzzle.n;
        newCol = oldCol;
        break;
      case "ArrowRight": // right arrow
        newRow = oldRow;
        newCol = (oldCol + 1) % this.props.puzzle.n;
        break;
      case "ArrowDown": // down arrow
        newRow = (oldRow + 1) % this.props.puzzle.n;
        newCol = oldCol;
        break;
      default:
        console.log("impossible!")
        newRow = oldRow;
        newCol = oldCol;
        break;
    }

    this.updateSelectedCell(newRow, newCol);
  }

  updateSelectedClue(number, across) {
    var newClueMask = this.newEmptyBoard(false);

    if (this.selectedClue.number === number && this.selectedClue.across === across)
      return;

    const coords = this.props.puzzle.clueToCoords.get(parseInt(number));
    const row = coords.row;
    const col = coords.col;

    if (across) {
      for (var c = col; c < this.props.puzzle.n && this.props.puzzle.squares[row][c] !== 1; c++)
        newClueMask[row][c] = true;
    } else {
      for (var r = row; r < this.props.puzzle.n && this.props.puzzle.squares[r][col] !== 1; r++)
        newClueMask[r][col] = true;
    }

    // Update instance variables
    this.selectedClue = {"number": number, "across": across};
    this.clueMask = newClueMask;

    if (this.selectedCell.row == -1 || !this.clueMask[this.selectedCell.row][this.selectedCell.col]) {
      this.updateSelectedCell(row, col);
    }

    // Push the update to the colors
    this.updateColors();
  }

  newEmptyBoard(fillValue) {
    return this.emptyBoard.map((row) => {
      return row.map( x => fillValue );
    });
  }

  render() {
    const colors = [];
    const names = [];

    colors.push(socket.color);
    names.push(socket.name);

    socket.friendsColors.forEach((color, id) => {colors.push(color);});
    socket.friendsNames.forEach((name, id) => {names.push(name);});

    const partyPeople = [];
    for (var i = 0; i < colors.length; i++) {
      partyPeople.push(
        <div
          className="friend-color"
          style={{backgroundColor: colors[i]}}
          key={i}
        ></div>,
        names[i],
        <br />
      );
    }

    return (
      <div>
        <div className="brand">
          <img src="logo.svg" alt="logo" width="22px"></img>
          <a href="/">Xword</a>
          <p><i>by Connor Hainje</i></p>
        </div>
        <div className="heading">
          <h1>{this.props.puzzle.title}</h1>
          <p>{this.props.puzzle.author} | {this.props.puzzle.paper} | {this.props.puzzle.date}</p>
        </div>
        <div className="game">
          <div className="game-board">
            <Board
              puzzle={this.props.puzzle}
              squareValues={this.state.squareValues}
              squareColors={this.state.squareColors}
              handleClick={(row, col) => {this.handleClick(row, col)}}
            />
          </div>
          <div className="clues-and-info">
            <div className="clue-boxes">
              <div className="clue-container">
                <h2>Across</h2>
                <Clues
                  handleClick={(number) => {this.updateSelectedClue(number, true)}}
                  clues={this.props.puzzle.across}
                  selectedClue={this.selectedClue.across ? this.selectedClue.number : 0}
                />
              </div>
              <div className="clue-container">
                <h2>Down</h2>
                <Clues
                  handleClick={(number) => {this.updateSelectedClue(number, false)}}
                  clues={this.props.puzzle.down}
                  selectedClue={this.selectedClue.across ? 0 : this.selectedClue.number}
                />
              </div>
            </div>
            <div className="party-container">
              <h1>Party</h1>
              <p>
                Room code: {this.props.roomCode}
              </p>
              {partyPeople}

            </div>
          </div>
        </div>
      </div>
    );
  }
}


class StartForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      puzzle: '2020_05_05_Andrew_White',
      color: '#EEB9B9',
      roomCode: '',
      makeRoom: false,
      connected: false,
    };

    socket.on('connected!', () => {
      this.setState((prevState, props) => {
        var newState = prevState;
        newState.connected = true;
        return newState;
      });
    });

    this.handleNameChange = this.handleNameChange.bind(this);
    this.handlePuzzleChange = this.handlePuzzleChange.bind(this);
    this.handleColorChange = this.handleColorChange.bind(this);
    this.handleRoomCodeChange = this.handleRoomCodeChange.bind(this);
    this.handleMakeRoomChange = this.handleMakeRoomChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleNameChange(event) {
    const newval = event.target.value;
    this.setState(
      (prevState, props) => {
        var newState = prevState;
        newState.name = newval;
        return newState;
      }
    );
  }

  handleRoomCodeChange(event) {
    const newval = event.target.value;
    this.setState(
      (prevState, props) => {
        var newState = prevState;
        newState.roomCode = newval;
        return newState;
      }
    );
  }

  handlePuzzleChange(event) {
    const newval = event.target.value;
    this.setState(
      (prevState, props) => {
        var newState = prevState;
        newState.puzzle = newval;
        return newState;
      }
    );
  }

  handleColorChange(event) {
    const newval = event.target.value;
    this.setState(
      (prevState, props) => {
        var newState = prevState;
        newState.color = newval;
        return newState;
      }
    );
  }

  handleMakeRoomChange(event) {
    this.setState(
      (prevState, props) => {
        var newState = prevState;
        newState.makeRoom = !prevState.makeRoom;
        return newState;
      },
      () => {
        if (this.state.makeRoom)
          document.getElementById('puzzleSelect').style.display = 'inline-block';
        else
          document.getElementById('puzzleSelect').style.display = 'none';
      }
    );
  }

  handleSubmit(event) {
    if (this.state.name === '') {
      alert('Name is required.');
      event.preventDefault();
      return;
    }
    if (this.state.roomCode === '') {
      alert('Room code is required.');
      event.preventDefault();
      return;
    }

    socket.name = this.state.name;
    socket.color = this.state.color;
    USER_COLOR = socket.color;
    socket.emit('userInfo', [socket.name, socket.color]);

    if (this.state.makeRoom) {
      socket.emit('makeRoom', [this.state.roomCode, this.state.puzzle]);
      socket.on('cantMakeRoom', () => { this.handleMakeIssue(); });
      socket.on('madeRoom', () => {
        this.props.onSubmit(this.state.puzzle, undefined, undefined, this.state.roomCode);
      });
    }
    else {
      socket.emit('joinRoom', this.state.roomCode);
      socket.on('cantJoinRoom', () => { this.handleJoinIssue(); });

      var received = false;
      socket.on('status', (data) => {
        if (received) { return; }
        received = true;
        socket.friendsColors = new Map(data.friendsColors);
        socket.friendsNames = new Map(data.friendsNames);
        this.props.onSubmit(data.puzzleID, data.boardStatus, data.friendsCells, this.state.roomCode);
      });
    }

    event.preventDefault();
  }

  handleMakeIssue() {
    alert('Room code already in use. Please try another.');
  }

  handleJoinIssue() {
    alert('Room doesn\'t exist. Please try a different room code.');
  }

  render() {
    return (
    
      <div>

        <div className="nav">
          <a href="#">cmhainje</a> / <a href="#"><b>Xword</b></a>
        </div>

        <div className="startForm">

          <p>Welcome to</p>

          <h1><img src="logo.svg" alt="logo" width="36px"></img>Xword</h1>
          <hr />

          <div className="server-status">
            <p style={{display: 'inline-block'}}><i>
              {this.state.connected ? "Connected to server." : "Not connected to server."}
            </i></p>
            <div className="server-status-box" style={{backgroundColor: this.state.connected ? '#C4EEB9' : '#EEB9B9'}}></div>
          </div>


          <form onSubmit={this.handleSubmit}>

            <div className="form-row">
              <label>
                Name
              </label>
              <div className="input">
                <input type="text" className="textbox" value={this.state.name} onChange={this.handleNameChange} />
              </div>
            </div>

            <div className="form-row">
              <label>
                Color
                <span className="color-box" style={{backgroundColor: this.state.color}}></span>
              </label>
              <div className="input">
                <select value={this.state.color} onChange={this.handleColorChange}>
                  <option value='#EEB9B9'> red </option>
                  <option value='#EED7B9'> orange </option>
                  <option value='#EEECB9'> yellow </option>
                  <option value='#E0EEB9'> yellow-green </option>
                  <option value='#C4EEB9'> green </option>
                  <option value='#B9EED8'> teal </option>
                  <option value='#B9EEEA'> cyan </option>
                  <option value='#B9D3EE'> blue </option>
                  <option value='#B9BAEE'> purple </option>
                  <option value='#D0B9EE'> lavender </option>
                  <option value='#E9B9EE'> pink </option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <label>
                Make a room?
              </label>
              <div className="input">
                <input type="checkbox" onChange={this.handleMakeRoomChange}></input>
              </div>
            </div>

            <div id="puzzleSelect" style={ {display: "none"} } className="form-row">
              <label>
                Crossword
              </label>
              <div className="input">
                <select value={this.state.puzzle} onChange={this.handlePuzzleChange}>
                  <option value="2019_10_20_Andrew_White">Nassau Weekly: October 10, 2019 by Andrew White</option>
                  <option value="2019_11_17_Andrew_White">Nassau Weekly: November 17, 2019 by Andrew White</option>
                  <option value="2019_11_24_Andrew_White">Nassau Weekly: November 24, 2019 by Andrew White</option>
                  <option value="2019_12_08_Andrew_White">Nassau Weekly: December 8, 2019 by Andrew White</option>
                  <option value="2020_02_16_Andrew_White">Nassau Weekly: February 16, 2020 by Andrew White</option>
                  <option value="2020_02_23_Andrew_White">Nassau Weekly: February 23, 2020 by Andrew White</option>
                  <option value="2020_03_01_Andrew_White">Nassau Weekly: March 1, 2020 by Andrew White and Reis White</option>
                  <option value="2020_03_08_Andrew_White">Nassau Weekly: March 8, 2020 by Andrew White</option>
                  <option value="2020_05_05_Andrew_White">Nassau Weekly: May 5, 2020 by Andrew White</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <label>
                Room code
              </label>
              <div className="input">
                <input type="text" className="textbox" value={this.state.roomCode} onChange={this.handleRoomCodeChange} />
              </div>
            </div>

            <div className="submit-btn-row">
              <input type="submit" className="submit-btn" value="Play" />
            </div>
          </form>
        </div>
      </div>

    );
  }
}


class Home extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gameVisible: false,
      puzzle: {},
    };
  }

  loadGame(puzzleID) {
    var puzzleURL = "puzzles/" + puzzleID + ".json";

    $.getJSON(puzzleURL, (puzzleData) => {
      const clueNumbers = getClueNumbers(puzzleData);
      const clueToCoords = makeClueToCoordsMap(puzzleData.puzzleSquares.length, clueNumbers);
      const clueAcrossArray = makeClueArray(puzzleData.puzzleSquares.length, clueNumbers, puzzleData, true);
      const clueDownArray   = makeClueArray(puzzleData.puzzleSquares.length, clueNumbers, puzzleData, false);

      const PUZZLE = {
        "title":   puzzleData.title,
        "author":  puzzleData.author,
        "paper":   puzzleData.paper,
        "date":    puzzleData.date,
        "squares": puzzleData.puzzleSquares,
        "across":  puzzleData.acrossClues,
        "down":    puzzleData.downClues,
        "n":       puzzleData.puzzleSquares.length,
        "clueNumbers": clueNumbers,
        "clueToCoords": clueToCoords,
        "clueAcrossArray": clueAcrossArray,
        "clueDownArray": clueDownArray,
        "id": puzzleID
      };

      this.setState(
        (prevState, props) => {
          return {
            gameVisible: true,
            puzzle: PUZZLE
          };
        }
      );
    });
  }

  handleFormSubmit(puzzleID, boardStatus, friendsCells, roomCode) {
    this.boardStatus = boardStatus;
    this.friendsCells = friendsCells;
    this.roomCode = roomCode;
    this.loadGame(puzzleID);
  }

  render() {
    if (this.state.gameVisible) {
      return <Game puzzle={this.state.puzzle} boardStatus={this.boardStatus} friendsCells={this.friendsCells} roomCode={this.roomCode}/>;
    }
    return <StartForm onSubmit={
      (puzzleID, boardStatus, friendsCells, roomCode) => {this.handleFormSubmit(puzzleID, boardStatus, friendsCells, roomCode);}
    }/>
  }
}

ReactDOM.render(
  <Home />,
  document.getElementById('root')
);
