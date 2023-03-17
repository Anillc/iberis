import { Grammar, Productor, TokenKind } from './grammar'

export interface Input {
  term: string
}

export type Inputter = () => Input

export interface Branch {
  branch: Productor
  nodes: (Input | Node)[]
}

export interface Node {
  name: string
  branches: Branch[]
}

interface Item {
  productor: Productor
  point: number
  origin: number
  node: Node
}

class ItemSet {
  map = new Map<string, Item>()
  items: Item[] = []
  add(item: Item) {
    const id = `${item.productor.id}:${item.point}:${item.origin}`
    const existed = this.map.get(id)
    if (existed) {
      return
    }
    this.map.set(id, item)
    this.items.push(item)
  }
}

export function parse(grammar: Grammar, inputter: Inputter) {
  const results: Node[] = []
  const sets: ItemSet[] = [new ItemSet()]
  const entries = grammar.get(grammar.entry)
  entries.forEach(productor => {
    sets[0].add({
      productor,
      point: 0,
      origin: 0,
      node: {
        name: productor.name,
        branches: [{
          branch: productor,
          nodes: [],
        }],
      },
    })
  })

  for (let i = 0; i < sets.length; i++) {
    let input: Input
    const set = sets[i]
    for (let j = 0; j < set.items.length; j++) {
      const item = set.items[j]
      if (item.productor.tokens.length === item.point) {
        // compete
        if (item.productor.name === grammar.entry && item.productor.isAccept) {
          results.push(item.node)
        }
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
            node: {
              name: origin.node.name,
              branches: origin.node.branches.map(branch => ({
                branch: branch.branch,
                nodes: branch.nodes.concat(item.node),
              }))
            },
          })
        }
      } else {
        const token = item.productor.tokens[item.point]
        if (token.kind === TokenKind.Term) {
          // scan
          input ||= inputter()
          if (!input || input.term !== token.token) continue
          const nextSet = (sets[i + 1] ||= new ItemSet())
          nextSet.add({
            productor: item.productor,
            point: item.point + 1,
            origin: item.origin,
            node: {
              name: item.node.name,
              branches: item.node.branches.map(branch => ({
                branch: branch.branch,
                nodes: branch.nodes.concat(input),
              })),
            },
          })
        } else {
          // predicate
          const predications = grammar.get(token.token)
          for (const productor of predications) {
            set.add({
              productor,
              point: 0,
              origin: i,
              node: {
                name: productor.name,
                // create new branch
                branches: [{
                  branch: productor,
                  nodes: [],
                }],
              },
            })
          }
          const nullableNodes = grammar.nullable(token.token)
          if (nullableNodes.length !== 0) {
            const newBranches: Branch[] = []
            for (const nullableNode of nullableNodes) {
              for (const branch of item.node.branches) {
                newBranches.push({
                  branch: branch.branch,
                  nodes: branch.nodes.concat(nullableNode),
                })
              }
            }
            set.add({
              productor: item.productor,
              point: item.point + 1,
              origin: item.origin,
              node: {
                name: item.node.name,
                branches: newBranches,
              },
            })
          }
        }
      }
    }
  }
  return results
}
