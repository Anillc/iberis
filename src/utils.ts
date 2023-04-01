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
      const nonTermSets = productor.tokens.map(token => map.get(token.token as string))
      if (nonTermSets.some(set => !set || set.size === 0)) continue
      set.add(productor)
      updated = true
    }
  }
  return map
}

export function isTerm<T>(token: Term<T> | NonTerm): token is Term<T> {
  return token.kind === TokenKind.Term
}

export function isParsingNode<T>(node: Input<T> | ParseNode<T>): node is ParseNode<T> {
  return !!node?.['productor']
}

function choose<T>(
  node: ParseNode<T>,
  map: Map<ParseNode<T>, (Input<T> | ParseNode<T>)[]>,
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

function _accept<T, C>(
  node: ParseNode<T>,
  context: C,
  map: Map<ParseNode<T>, (Input<T> | ParseNode<T>)[]>,
) {
  const branch = map.get(node)
  const args = []
  for (const node of branch) {
    const arg = isParsingNode(node) ? _accept(node, context, map) : node
    args.push(arg)
  }
  return node.productor.accept(...args, context)
}

export function accept<T, C>(node: ParseNode<T>, context?: C) {
  const map = new Map<ParseNode<T>, (Input<T> | ParseNode<T>)[]>()
  if (!choose(node, map)) {
    return null
  }
  return _accept(node, context, map)
}
