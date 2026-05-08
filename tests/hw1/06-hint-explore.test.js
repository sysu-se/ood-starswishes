import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('HW2 hint and explore behavior', () => {
  it('returns candidates for an empty cell', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    expect(sudoku.getCandidates(0, 2)).toEqual([1, 2, 4])
  })

  it('returns a next hint from the current board', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    const hint = sudoku.getNextHint()

    expect(hint).toEqual(expect.objectContaining({
      row: expect.any(Number),
      col: expect.any(Number),
      value: expect.any(Number),
      candidates: expect.any(Array),
    }))
  })

  it('can commit explore results as one main history step', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    expect(game.isExploring()).toBe(true)
    expect(game.commitExplore()).toBe(true)
    expect(game.isExploring()).toBe(false)
    expect(game.getSudoku().getGrid()[1][1]).toBe(7)

    game.undo()
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)
    expect(game.getSudoku().getGrid()[1][1]).toBe(0)
  })

  it('can abandon explore results and remember failed paths', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })

    expect(game.abandonExplore()).toBe(true)
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })

    expect(game.isFailedExploration()).toBe(true)
    expect(game.hasConflict()).toBe(true)
  })

  it('can reset explore results while staying in explore mode', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })

    expect(game.resetExplore()).toBe(true)
    expect(game.isExploring()).toBe(true)
    expect(game.getSudoku().getGrid()[0][2]).toBe(0)
    expect(game.getSudoku().getGrid()[1][1]).toBe(0)
    expect(game.canUndo()).toBe(false)

    game.guess({ row: 0, col: 2, value: 4 })
    game.guess({ row: 1, col: 1, value: 7 })
    expect(game.isFailedExploration()).toBe(true)
  })

  it('round-trips active explore state and failed exploration memory', async () => {
    const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })
    game.abandonExplore()
    game.enterExplore()
    game.guess({ row: 0, col: 2, value: 4 })

    const restored = createGameFromJSON(JSON.parse(JSON.stringify(game.toJSON())))

    expect(restored.isExploring()).toBe(true)
    expect(restored.getSudoku().getGrid()[0][2]).toBe(4)
    expect(restored.isFailedExploration()).toBe(true)
    expect(restored.hasConflict()).toBe(true)

    restored.abandonExplore()
    expect(restored.getSudoku().getGrid()[0][2]).toBe(0)
  })

  it('detects rule conflicts', async () => {
    const { createGame, createSudoku } = await loadDomainApi()
    const game = createGame({ sudoku: createSudoku(makePuzzle()) })

    game.guess({ row: 0, col: 2, value: 5 })

    expect(game.hasConflict()).toBe(true)
  })
})
