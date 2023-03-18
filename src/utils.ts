import { Grammar, Productor, TokenKind } from './grammar'
import { Node } from './parse'

export function cartesian<T>(factors: T[][]): T[][] {
  let result = factors[0].map(factor => [factor])
  for (let i = 1; i < factors.length; i++) {
    const next = []
    for (const x of result) {
      for (const y of factors[i]) {
        next.push([...x, y])
      }
    }
    result = next
  }
  return result
}

export function nullableMap(grammar: Grammar) {
  const productors = [...grammar.values()].flat()
  const nullableProductors = new Map<string, Set<Productor>>()
  let updated = true
  while (updated) {
    updated = false
    for (const productor of productors) {
      let set = nullableProductors.get(productor.name)
      if (!set) {
        set = new Set()
        nullableProductors.set(productor.name, set)
      } else if (set.has(productor)) {
        continue
      }
      if (productor.tokens.length === 0) {
        set.add(productor)
        updated = true
        continue
      }
      if (productor.tokens.some(token => token.kind === TokenKind.Term)) continue
      const nonTermSets = productor.tokens.map(token => nullableProductors.get(token.token))
      if (nonTermSets.some(set => !set || set.size === 0)) continue
      set.add(productor)
      updated = true
    }
  }
  const nullableMap = new Map<string, Node[]>()
  for (const [name, set] of nullableProductors) {
    if (set.size === 0) continue
    nullableMap.set(name, [...set].map(productor => ({ productor, branches: null })))
  }
  for (const nodes of nullableMap.values()) {
    for (const node of nodes) {
      if (node.productor.tokens.length === 0) {
        node.branches = [[]]
      } else {
        const tokens = node.productor.tokens.map(token => nullableMap.get(token.token))
        node.branches = cartesian(tokens)
      }
    }
  }
  return nullableMap
}
