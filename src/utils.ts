import { Grammar, Productor, TokenKind } from './grammar'

export function nullableMap(grammar: Grammar) {
  const productors = [...grammar.values()].flat()
  const map = new Map<string, Set<Productor>>()
  let updated = true
  while (updated) {
    updated = false
    for (const productor of productors) {
      let set = map.get(productor.name)
      if (!set) {
        set = new Set()
        map.set(productor.name, set)
      } else if (set.has(productor)) {
        continue
      }
      if (productor.tokens.length === 0) {
        set.add(productor)
        updated = true
        continue
      }
      if (productor.tokens.some(token => token.kind === TokenKind.Term)) continue
      const nonTermSets = productor.tokens.map(token => map.get(token.token))
      if (nonTermSets.some(set => !set || set.size === 0)) continue
      set.add(productor)
      updated = true
    }
  }
  return map
}
