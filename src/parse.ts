import { Grammar, Productor, TokenKind } from './grammar'

export interface Text {
  term: string
}

export type Texter = (type: string) => Text

export interface Branch {
  branch: Productor
  node: Node
}

export interface Node {
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

class Cache<K, V> {
  map = new Map<K, V>()
  get(key: K, create?: (key: K) => V) {
    let value = this.map.get(key)
    if (!value && create) {
      value = create(key)
      this.map.set(key, value)
    }
    return value
  }
}

export function parse(grammar: Grammar, texter: Texter) {
  const results: Branch[] = []
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
    const textCache = new Cache<string, Text>()
    for (let j = 0; j < set.items.length; j++) {
      const item = set.items[j]
      if (item.productor.tokens.length === item.point) {
        // compete
        if (item.productor.name === grammar.entry) {
          results.push({
            branch: item.productor,
            node: item.node,
          } satisfies Branch)
        }
        // length of items may change in this loop
        const origins = sets[item.origin].items
        const len = origins.length
        for (let k = 0; k < len; k++) {
          const origin = origins[k]
          if (origin.productor.tokens[origin.point]?.token !== item.productor.name) {
            continue
          }
          const nextNode: Node = {
            name: origin.node.name,
            nodes: [...origin.node.nodes],
          }
          const branches = (nextNode.nodes[origin.point] ||= []) as Branch[]
          branches.push({
            branch: item.productor,
            node: item.node,
          })
          set.add({
            productor: origin.productor,
            point: origin.point + 1,
            origin: origin.origin,
            node: nextNode,
          })
        }
      } else {
        const token = item.productor.tokens[item.point]
        if (token.kind === TokenKind.Term) {
          // scan
          const text = textCache.get(token.token, texter)
          if (!text) continue
          const nextSet = (sets[i + 1] ||= new ItemSet())
          const nextNode: Node = {
            name: item.node.name,
            nodes: [...item.node.nodes, text],
          }
          nextSet.add({
            productor: item.productor,
            point: item.point + 1,
            origin: item.origin,
            node: nextNode,
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
            // This branch will be added in the predications,
            // so we don't need to create a branch now.
            set.add({
              productor: item.productor,
              point: item.point + 1,
              origin: item.origin,
              node: {
                name: item.node.name,
                nodes: [...item.node.nodes],
              },
            })
          }
        }
      }
    }
  }
  return results
}
