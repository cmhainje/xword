import React from 'react';
import ReactDOM from 'react-dom';
import openSocket from 'socket.io-client'
import $ from 'jquery'

import './index.css';


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

var USER_COLOR = '#EED7B9';
const CLUE_COLOR = '#C9F0EA';


// ====
// SERVER SET-UP





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
        style={ (this.props.selectedClue === number) ? { backgroundColor: CLUE_COLOR } : { backgroundColor: "white" } }
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

    this.state = {
      squareValues: this.newEmptyBoard(""),
      squareColors: this.newEmptyBoard("#FFFFFF"),
    };

    this.selectedCell = {"row": -1, "col": -1};
    this.selectMask = this.newEmptyBoard(false);

    this.selectedClue = {"number": 0, "across": true};
    this.clueMask = this.newEmptyBoard(false);

    this.friendsCells = [];
    this.friendMask = this.newEmptyBoard("");

    // Event listeners for keypresses
    document.addEventListener("keypress", (event) => {
      this.handleKeyPress(event.key);
    });

    document.addEventListener("keydown", (event) => {
      var c = event.keyCode;
      if (c === 37 || c === 38 || c=== 39 || c === 40)
        this.handleArrowKeyPress(c);
      else if (c === 8)
        this.handleBackspacePress();
    });

    // Server listeners for updates
    this.props.socket.on('valueUpdate', (newValues) => {
      this.setState((prevState, props) => {
        return {
          squareValues: newValues,
          squareColors: prevState.squareColors,
        };
      });
    });

    this.props.socket.on('selectUpdate', (data) => {
      const [row, col, id] = data;
      var found = false;
      for (i = 0; i < this.friendsCells.length; i++) {
        if (this.friendsCells[i].id === id) {
          found = true;
          this.friendsCells[i] = {"row": row, "col": col, "id": id};
        }
      }
      if (!found) {
        this.friendsCells.push({"row": row, "col": col, "id": id});
      }

      var newFriendMask = this.newEmptyBoard("");
      for (i = this.friendsCells.length - 1; i >= 0; i--) {
        const row = this.friendsCells[i].row;
        const col = this.friendsCells[i].col;
        const color = this.props.socket.friends.get(this.friendsCells[i].id);

        newFriendMask[row][col] = color;
      }

      this.friendMask = newFriendMask;
      this.updateColors();
    });


    this.props.socket.on('byeFriend', (id) => {
      this.props.socket.friends.delete(id);
      var newFriendsCells = [];
      for (i = 0; i < this.friendsCells.length; i++) {
        if (this.friendsCells[i].id !== id) {
          newFriendsCells.push(this.friendsCells[i]);
        }
      }
      this.friendsCells = newFriendsCells;

      var newFriendMask = this.newEmptyBoard("");
      for (i = this.friendsCells.length - 1; i >= 0; i--) {
        const row = this.friendsCells[i].row;
        const col = this.friendsCells[i].col;
        const color = this.props.socket.friends.get(this.friendsCells[i].id);

        newFriendMask[row][col] = color;
      }

      this.friendMask = newFriendMask;
      this.updateColors();
    });
  }

  updateValue(row, col, newValue) {
    var newValues = this.state.squareValues.map(x => x);
    newValues[row][col] = newValue;

    this.setState(
      (prevState, props) => {
        return {
          squareValues: newValues,
          squareColors: prevState.squareColors,
        };
      },
      () => { this.props.socket.emit('updateValue', newValues); }
    );
  }

  handleKeyPress(key) {
    const row = this.selectedCell.row;
    const col = this.selectedCell.col;
    this.updateValue(row, col, key.toUpperCase());

    // If there is a clue selected, move selected cell forward along the clue direction
    if (this.selectedClue.number !== 0) {
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

    // If there is a clue selected, move selected cell backward along the clue direction
    if (this.selectedClue.number !== 0) {
      if (this.selectedClue.across && col - 1 >= 0 && this.props.puzzle.squares[row][col-1] !== 1)
        this.updateSelectedCell(row, col - 1);
      else if (!this.selectedClue.across && row - 1 >= 0 && this.props.puzzle.squares[row-1][col] !== 1)
        this.updateSelectedCell(row - 1, col);
    }
  }

  updateColors() {
    this.setState(
      (prevState, props) => {
        var newColors = this.newEmptyBoard("#FFFFFF");
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

    this.props.socket.emit('updateSelect', [row, col]);
  }

  handleArrowKeyPress(keyCode) {
    const oldRow = this.selectedCell.row;
    const oldCol = this.selectedCell.col;
    var newRow, newCol;

    switch (keyCode) {
      case 37: // left arrow
        newRow = oldRow;
        newCol = (oldCol - 1 + this.props.puzzle.n) % this.props.puzzle.n;
        break;
      case 38: // up arrow
        newRow = (oldRow - 1 + this.props.puzzle.n) % this.props.puzzle.n;
        newCol = oldCol;
        break;
      case 39: // right arrow
        newRow = oldRow;
        newCol = (oldCol + 1) % this.props.puzzle.n;
        break;
      case 40: // down arrow
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

    if (this.selectedClue.number === number && this.selectedClue.across === across) {
      this.selectedClue = {"number": 0, "across": true};
      this.clueMask = newClueMask;
      this.updateColors();
      return;
    }

    const coords = this.puzzle.clueToCoords.get(parseInt(number));
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

    // Move selected cell to start of clue
    this.updateSelectedCell(row, col);

    // Push the update to the colors
    this.updateColors();
  }

  newEmptyBoard(fillValue) {
    return this.emptyBoard.map((row) => {
      return row.map( x => fillValue );
    });
  }

  render() {
    return (
      <div className="game">
        <div className="heading">
          <h1>{this.props.puzzle.title}</h1>
          <p>{this.props.puzzle.author} | {this.props.puzzle.paper} | {this.props.puzzle.date}</p>
        </div>
        <div className="game-board">
          <Board
            puzzle={this.props.puzzle}
            squareValues={this.state.squareValues}
            squareColors={this.state.squareColors}
            handleClick={(row, col) => {this.updateSelectedCell(row, col)}}
          />
        </div>
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
        <div className="party-container">
          <h1>Party</h1>
          <p>
            This is where I will put info about people who are connected to the server.
          </p>
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
      puzzle: {}
    };

    this.loadGame = this.loadGame.bind(this);

    this.socket = openSocket('http://208.64.170.251:8000');
    this.socket.on('color', (color) => {
      this.socket.color = color;
      USER_COLOR = this.socket.color;
    });
    this.socket.on('id', (id) => { this.socket.id = id; });

    this.socket.friends = new Map();
    this.socket.on('newFriend', (data) => {
      if (data[0] === this.socket.id) return;
      this.socket.friends.set(data[0], data[1]);
    });
  }

  loadGame(puzzleURL) {
    $.getJSON(puzzleURL, (puzzleData) => {
      const clueNumbers = getClueNumbers(puzzleData);
      const clueToCoords = makeClueToCoordsMap(puzzleData.puzzleSquares.length, clueNumbers);

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
      };

      this.setState({ gameVisible: true, puzzle: PUZZLE });
    });
  }

  render() {
    if (this.state.gameVisible) {
      return <Game puzzle={this.state.puzzle} socket={this.socket} />;
    }
    return (
      <div className="home-menu">
        <h1>Xword home</h1>

        <ul>
          <li onClick={() => {this.loadGame('puzzles/2020_03_08_Andrew_White.json')}}>March 8th, 2020 by Andrew White</li>
          <li onClick={() => {this.loadGame('puzzles/2020_05_05_Andrew_White.json')}}>May 5th, 2020 by Andrew White</li>
        </ul>
      </div>
    );
  }
}

ReactDOM.render(
  <Home />,
  document.getElementById('root')
);
