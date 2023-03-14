import { Grammar, Productor, TokenKind } from './grammar'

export interface Text {
  term: string
}

export type Texter = (type: string) => Text

interface Item {
  productor: Productor
  point: number
  origin: number
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
          continue
        }
        for (const origin of sets[item.origin].items) {
          if (origin.productor.tokens[origin.point]?.token !== item.productor.name) {
            continue
          }
          set.add({
            productor: origin.productor,
            point: origin.point + 1,
            origin: origin.origin,
          })
          // TODO: build tree
          console.log(`build ${item.productor.name}`)
        }
      } else {
        const token = item.productor.tokens[item.point]
        if (token.kind === TokenKind.Term) {
          // scan
          const text = texter(token.token)
          if (!text) continue
          const nextSet = (sets[i + 1] ||= new ItemSet())
          nextSet.add({
            productor: item.productor,
            point: item.point + 1,
            origin: item.origin,
          })
          // TODO: save token
        } else {
          // predicate
          const predications = grammar.get(token.token)
          predications.forEach(productor => {
            set.add({
              productor,
              point: 0,
              origin: i,
            })
          })
          if (grammar.nullable(token.token)) {
            set.add({
              productor: item.productor,
              point: item.point + 1,
              origin: item.origin
            })
          }
        }
      }
    }
  }
}