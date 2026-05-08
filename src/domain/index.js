const SIZE = 9;
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function copyGrid(grid) {
	return grid.map(row => row.slice());
}

function gridKey(grid) {
	return grid.flat().join('');
}

function assertPosition(row, col) {
	if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= SIZE || col < 0 || col >= SIZE) {
		throw new RangeError('row and col must be integers from 0 to 8');
	}
}

function assertValue(value) {
	if (!Number.isInteger(value) || value < 0 || value > 9) {
		throw new RangeError('value must be an integer from 0 to 9');
	}
}

function normalizeMove(move) {
	const { row, col, value } = move;
	assertPosition(row, col);
	assertValue(value);
	return { row, col, value };
}

function hasDuplicate(values) {
	const seen = new Set();
	for (const value of values) {
		if (value === 0) continue;
		if (seen.has(value)) return true;
		seen.add(value);
	}
	return false;
}

function boxValues(grid, row, col) {
	const startRow = Math.floor(row / 3) * 3;
	const startCol = Math.floor(col / 3) * 3;
	const values = [];
	for (let r = startRow; r < startRow + 3; r++) {
		for (let c = startCol; c < startCol + 3; c++) {
			values.push(grid[r][c]);
		}
	}
	return values;
}

function validateGrid(grid) {
	if (!Array.isArray(grid) || grid.length !== SIZE) {
		throw new TypeError('grid must be a 9x9 array');
	}
	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SIZE) {
			throw new TypeError('grid must be a 9x9 array');
		}
		for (const value of row) {
			assertValue(value);
		}
	}
}

class Sudoku {
	constructor(grid) {
		validateGrid(grid);
		this.grid = copyGrid(grid);
	}

	getGrid() {
		return copyGrid(this.grid);
	}

	guess(move) {
		const { row, col, value } = normalizeMove(move);
		this.grid[row][col] = value;
		return this;
	}

	clone() {
		return new Sudoku(this.grid);
	}

	getCandidates(row, col) {
		assertPosition(row, col);
		if (this.grid[row][col] !== 0) return [];

		const used = new Set([
			...this.grid[row],
			...this.grid.map(r => r[col]),
			...boxValues(this.grid, row, col),
		]);

		return VALUES.filter(value => !used.has(value));
	}

	getNextHint() {
		for (let row = 0; row < SIZE; row++) {
			for (let col = 0; col < SIZE; col++) {
				const candidates = this.getCandidates(row, col);
				if (candidates.length === 1) {
					return {
						row,
						col,
						value: candidates[0],
						candidates,
						reason: 'Only one value is valid for this cell.',
					};
				}
			}
		}

		let best = null;
		for (let row = 0; row < SIZE; row++) {
			for (let col = 0; col < SIZE; col++) {
				const candidates = this.getCandidates(row, col);
				if (candidates.length > 0 && (!best || candidates.length < best.candidates.length)) {
					best = { row, col, value: candidates[0], candidates, reason: 'No forced move is available; this is the smallest candidate set.' };
				}
			}
		}
		return best;
	}

	hasConflict() {
		for (let i = 0; i < SIZE; i++) {
			if (hasDuplicate(this.grid[i])) return true;
			if (hasDuplicate(this.grid.map(row => row[i]))) return true;
		}

		for (let row = 0; row < SIZE; row += 3) {
			for (let col = 0; col < SIZE; col += 3) {
				if (hasDuplicate(boxValues(this.grid, row, col))) return true;
			}
		}
		return false;
	}

	toJSON() {
		return { grid: this.getGrid() };
	}

	toString() {
		return this.grid.map(row => row.map(value => value || '.').join(' ')).join('\n');
	}
}

class Game {
	constructor({ sudoku, undoStack = [], redoStack = [], explore = null, failedExplorations = [] }) {
		this.sudoku = sudoku.clone();
		this.undoStack = undoStack.map(copyGrid);
		this.redoStack = redoStack.map(copyGrid);
		this.explore = explore ? {
			origin: copyGrid(explore.origin),
			undoStack: (explore.undoStack || []).map(copyGrid),
			redoStack: (explore.redoStack || []).map(copyGrid),
		} : null;
		this.failedExplorations = new Set(failedExplorations);
	}

	getSudoku() {
		return this.sudoku;
	}

	guess(move) {
		const stack = this.explore ? this.explore.undoStack : this.undoStack;
		stack.push(this.sudoku.getGrid());
		this.sudoku.guess(move);
		if (this.explore) {
			this.explore.redoStack = [];
		} else {
			this.redoStack = [];
		}
		return this;
	}

	undo() {
		const undoStack = this.explore ? this.explore.undoStack : this.undoStack;
		const redoStack = this.explore ? this.explore.redoStack : this.redoStack;
		if (undoStack.length === 0) return false;
		redoStack.push(this.sudoku.getGrid());
		this.sudoku = new Sudoku(undoStack.pop());
		return true;
	}

	redo() {
		const undoStack = this.explore ? this.explore.undoStack : this.undoStack;
		const redoStack = this.explore ? this.explore.redoStack : this.redoStack;
		if (redoStack.length === 0) return false;
		undoStack.push(this.sudoku.getGrid());
		this.sudoku = new Sudoku(redoStack.pop());
		return true;
	}

	canUndo() {
		return (this.explore ? this.explore.undoStack : this.undoStack).length > 0;
	}

	canRedo() {
		return (this.explore ? this.explore.redoStack : this.redoStack).length > 0;
	}

	getCandidates(row, col) {
		return this.sudoku.getCandidates(row, col);
	}

	getNextHint() {
		return this.sudoku.getNextHint();
	}

	enterExplore() {
		if (!this.explore) {
			this.explore = { origin: this.sudoku.getGrid(), undoStack: [], redoStack: [] };
		}
		return this;
	}

	isExploring() {
		return this.explore !== null;
	}

	commitExplore() {
		if (!this.explore) return false;
		this.undoStack.push(this.explore.origin);
		this.redoStack = [];
		this.explore = null;
		return true;
	}

	abandonExplore() {
		if (!this.explore) return false;
		this.failedExplorations.add(gridKey(this.sudoku.getGrid()));
		this.sudoku = new Sudoku(this.explore.origin);
		this.explore = null;
		return true;
	}

	resetExplore() {
		if (!this.explore) return false;
		this.failedExplorations.add(gridKey(this.sudoku.getGrid()));
		this.sudoku = new Sudoku(this.explore.origin);
		this.explore.undoStack = [];
		this.explore.redoStack = [];
		return true;
	}

	hasConflict() {
		return this.sudoku.hasConflict() || this.isFailedExploration();
	}

	isFailedExploration() {
		return this.failedExplorations.has(gridKey(this.sudoku.getGrid()));
	}

	toJSON() {
		return {
			sudoku: this.sudoku.toJSON(),
			undoStack: this.undoStack.map(copyGrid),
			redoStack: this.redoStack.map(copyGrid),
			explore: this.explore ? {
				origin: copyGrid(this.explore.origin),
				undoStack: this.explore.undoStack.map(copyGrid),
				redoStack: this.explore.redoStack.map(copyGrid),
			} : null,
			failedExplorations: [...this.failedExplorations],
		};
	}
}

export function createSudoku(grid) {
	return new Sudoku(grid);
}

export function createSudokuFromJSON(json) {
	return new Sudoku(json.grid);
}

export function createGame({ sudoku }) {
	return new Game({ sudoku });
}

export function createGameFromJSON(json) {
	return new Game({
		sudoku: createSudokuFromJSON(json.sudoku),
		undoStack: json.undoStack || [],
		redoStack: json.redoStack || [],
		explore: json.explore || null,
		failedExplorations: json.failedExplorations || [],
	});
}
