import { Grammar, Productor, TokenKind } from './grammar'
import { ParsingError } from './utils'

export type Inputter<T> = (items: Item<T>[]) => [Item<T>[], Input]

export interface Input {
  text: string
  position: number
  next?: number
}

export interface ParseNode<T> {
  productor: Productor<T>
  start: number
  next: number
  branches: (Input | ParseNode<T>)[][]
}

export interface Item<T> {
  productor: Productor<T>
  point: number
  origin: number
}

class ItemSet<T> {
  map = new Map<string, Item<T>>()
  items: Item<T>[] = []
  add(item: Item<T>) {
    const id = `${item.productor.id}:${item.point}:${item.origin}`
    const existed = this.map.get(id)
    if (existed) {
      return
    }
    this.map.set(id, item)
    this.items.push(item)
  }
}

export function parse<T>(
  grammar: Grammar<T>,
  inputter: Inputter<T>,
  equals: (text: string, token: T) => boolean,
) {
  const inputs: Input[] = []

  const sets: ItemSet<T>[] = [new ItemSet()]
  const entries = grammar.get(grammar.entry)
  entries.forEach(productor => {
    sets[0].add({
      productor,
      point: 0,
      origin: 0,
    })
  })

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i]
    for (let j = 0; j < set.items.length; j++) {
      const item = set.items[j]
      if (item.productor.tokens.length === item.point) {
        // compete
        // length of items may change in this loop
        const origins = sets[item.origin].items
        const len = origins.length
        for (let k = 0; k < len; k++) {
          const origin = origins[k]
          if (origin.productor.tokens[origin.point]?.token !== item.productor.name) {
            continue
          }
          set.add({
            productor: origin.productor,
            point: origin.point + 1,
            origin: origin.origin,
          })
        }
      } else {
        const token = item.productor.tokens[item.point]
        if (token.kind === TokenKind.NonTerm) {
          // predicate
          const predications = grammar.get(token.token)
          if (!predications) continue
          for (const productor of predications) {
            set.add({
              productor,
              point: 0,
              origin: i,
            })
          }
          const nullableParsingNodes = grammar.nullable(token.token)
          if (nullableParsingNodes && nullableParsingNodes.size !== 0) {
            set.add({
              productor: item.productor,
              point: item.point + 1,
              origin: item.origin,
            })
          }
        }
      }
    }
    // scan
    const termItems = set.items.filter(item => {
      const token = item.productor.tokens[item.point]
      return token && token.kind === TokenKind.Term
    })
    if (termItems.length === 0) break
    const temp = inputter(termItems)
    // EOF
    if (!temp) break
    const [nextItems, input] = temp
    if (!input) {
      const terms = termItems.map(item =>
        item.productor.tokens[item.point])
      const position = inputs[0] ? inputs[0].position + inputs[0].text.length : 0
      throw new ParsingError<T>(position, terms)
    }
    input.next = inputs.length + 1
    inputs.push(input)
    const nextSet = sets[i + 1] = new ItemSet()
    for (const item of nextItems) {
      nextSet.add({
        productor: item.productor,
        point: item.point + 1,
        origin: item.origin,
      })
    }
  }

  const transposed: Set<Productor<T>>[][] = []
  for (const [end, set] of sets.entries()) {
    for (const item of set.items) {
      if (item.productor.tokens.length !== item.point) continue
      const starts = transposed[item.origin] ||= []
      const productors = starts[end] ||= new Set()
      productors.add(item.productor)
    }
  }

  function search(
    name: string,
    start: number,
    searched: Map<string, Map<number, ParseNode<T>[]>>,
  ): ParseNode<T>[] {
    let startMap = searched.get(name)
    if (!startMap) {
      startMap = new Map()
      searched.set(name, startMap)
    }
    const cached = startMap.get(start)
    if (cached) return cached

    const results: ParseNode<T>[] = []
    startMap.set(start, results)
    const starts = transposed[start]
    if (!starts) return results
    for (const [next, set] of starts.entries()) {
      if (!set) continue
      for (const productor of set) {
        if (productor.name !== name) continue
        results.push({
          productor,
          start, next,
          branches: null,
        })
      }
    }
    for (const node of results) {
      let branches: (Input | ParseNode<T>)[][] = [[]]
      for (const token of node.productor.tokens) {
        if (token.kind === TokenKind.Term) {
          const newBranches: (Input | ParseNode<T>)[][] = []
          for (const branch of branches) {
            const branchNext = branch.at(-1)?.next || start
            if (branchNext + 1 > node.next || !equals(inputs[branchNext].text, token.token)) {
              continue
            }
            newBranches.push(branch.concat(inputs[branchNext]))
          }
          branches = newBranches
        } else {
          const newBranches: (Input | ParseNode<T>)[][] = []
          for (const branch of branches) {
            const nextParsingNodes = search(token.token, branch.at(-1)?.next || start, searched)
            for (const next of nextParsingNodes) {
              if (next.next > node.next) continue
              newBranches.push(branch.concat(next))
            }
          }
          branches = newBranches
        }
      }
      node.branches = branches.filter(branch => (branch.at(-1)?.next || start) === node.next)
    }
    let i = 0
    while (i < results.length) {
      if (results[i].branches.length === 0) {
        results.splice(i, 1)
      } else {
        i++
      }
    }
    return results
  }
  const nodes = search(grammar.entry, 0, new Map())
  return nodes.filter(node => node.next === inputs.length)
}
