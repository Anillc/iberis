import { Grammar, NonTerm, Productor, Term, TokenKind } from './grammar'
import { Input, ParseNode } from './parse'

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

export function isParsingNode(node: Input | ParseNode): node is ParseNode {
  return !!node?.['productor']
}

function choose(
  node: ParseNode,
  map: Map<ParseNode, (Input | ParseNode)[]>,
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

function _accept<T>(
  node: ParseNode,
  context: T,
  map: Map<ParseNode, (Input | ParseNode)[]>,
) {
  const branch = map.get(node)
  const args = []
  for (const node of branch) {
    const arg = isParsingNode(node) ? _accept(node, context, map) : node
    args.push(arg)
  }
  return node.productor.accept(...args, context)
}

export function accept<T>(node: ParseNode, context?: T) {
  const map = new Map<ParseNode, (Input | ParseNode)[]>()
  if (!choose(node, map)) {
    return null
  }
  return _accept(node, context, map)
}
