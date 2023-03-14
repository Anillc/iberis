import { Grammar, Productor, Token, TokenKind } from './grammar'

export interface Text {
  term: string
}

export type Texter = (type: string) => Text

interface Branch {
  branch: Productor
  node: Node  
}

interface Node {
  name: string
  nodes: (Text | Branch[])[]
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
    if (this.map.get(id)) {
      return false
    }
    this.map.set(id, item)
    this.items.push(item)
    return true
  }
}

export function parse(grammar: Grammar, texter: Texter) {
  const sets: ItemSet[] = [new ItemSet()]
  const entries = grammar.get(grammar.entry)
  entries.forEach(productor => {
    sets[0].add({
      productor,
      point: 0,
      origin: 0,
      node: {
        name: productor.name,
        nodes: [],
      },
    })
  })

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i]
    for (let j = 0; j < set.items.length; j++) {
      const item = set.items[j]
      if (item.productor.tokens.length === item.point) {
        // compete
        // TODO: accept entry
        if (item.productor.name === grammar.entry) {
          console.log('accept')
        }
        for (const origin of sets[item.origin].items) {
          if (origin.productor.tokens[origin.point]?.token !== item.productor.name) {
            continue
          }
          const branch = (origin.node.nodes[origin.point] ||= []) as Branch[]
          branch.push({
            branch: item.productor,
            node: item.node,
          })
          set.add({
            productor: origin.productor,
            point: origin.point + 1,
            origin: origin.origin,
            node: origin.node,
          })
        }
      } else {
        const token = item.productor.tokens[item.point]
        if (token.kind === TokenKind.Term) {
          // scan
          const text = texter(token.token)
          if (!text) continue
          const nextSet = (sets[i + 1] ||= new ItemSet())
          item.node.nodes.push(text)
          nextSet.add({
            productor: item.productor,
            point: item.point + 1,
            origin: item.origin,
            node: item.node,
          })
        } else {
          // predicate
          const predications = grammar.get(token.token)
          predications.forEach(productor => {
            set.add({
              productor,
              point: 0,
              origin: i,
              node: {
                name: productor.name,
                nodes: [],
              },
            })
          })
          const nullables = grammar.nullable(token.token)
          if (nullables.size !== 0) {
            const branches: Branch[] = [...nullables].map(productor => ({
              branch: productor,
              node: {
                name: productor.name,
                nodes: [],
              },
            }))
            item.node.nodes.push(branches)
            set.add({
              productor: item.productor,
              point: item.point + 1,
              origin: item.origin,
              node: item.node,
            })
          }
        }
      }
    }
  }
}