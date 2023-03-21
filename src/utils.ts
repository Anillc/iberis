import { Grammar, NonTerm, Productor, Term, TokenKind } from './grammar'
import { Input, ParsingNode } from './parse'

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

export function isTerm(token: Term | NonTerm): token is Term {
  return token.kind === TokenKind.Term
}

export function isParsingNode(node: Input | ParsingNode): node is ParsingNode {
  return !node['term']
}

function choose(
  node: ParsingNode,
  map: Map<ParsingNode, (Input | ParsingNode)[]>,
) {
  const chosen = map.get(node)
  if (chosen || chosen === null) return true
  map.set(node, null)
  const branch = node.productor.choose(node)
  if (!branch) return false
  map.set(node, branch)
  if (!branch.filter(isParsingNode).every(node => choose(node, map))) {
    return false
  }
  map.set(node, branch)
  return true
}

function _accept(
  node: ParsingNode,
  map: Map<ParsingNode, (Input | ParsingNode)[]>,
) {
  const branch = map.get(node)
  const args = []
  for (const node of branch) {
    const arg = isParsingNode(node) ? _accept(node, map) : node
    args.push(arg)
  }
  return node.productor.accept(...args)
}

export function accept(node: ParsingNode) {
  const map = new Map<ParsingNode, (Input | ParsingNode)[]>()
  if (!choose(node, map)) {
    return null
  }
  return _accept(node, map)
}
