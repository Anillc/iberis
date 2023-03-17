import { parse, Inputter, Node } from './parse'

export enum TokenKind {
  Term, NonTerm
}

export interface Term {
  kind: TokenKind.Term
  token: string
}

export interface NonTerm {
  kind: TokenKind.NonTerm
  token: string
}

export type Token = Term | NonTerm

export class Productor {
  tokens: Token[] = []
  isAccept = false
  constructor(public name: string, public id: number) {}
  t = this.term
  n = this.nonterm
  term(token: string) {
    this.tokens.push({
      kind: TokenKind.Term,
      token,
    })
    return this
  }
  nonterm(token: string) {
    this.tokens.push({
      kind: TokenKind.NonTerm,
      token,
    })
    return this
  }
  accept() {
    this.isAccept = true
  }
}

export class Grammar extends Map<string, Productor[]> {
  productorCount = 0
  nullableMap: Map<string, Node[]>
  constructor(public entry: string) {
    super()
  }
  p = this.productor
  productor(name: string) {
    this.nullableMap = null
    let productors = this.get(name)
    if (!productors) {
      productors = []
      this.set(name, productors)
    }
    const productor = new Productor(name, this.productorCount++)
    productors.push(productor)
    return productor
  }
  nullable(name: string) {
    if (!this.nullableMap) {
      const map = nullableMap(this)
      this.nullableMap = map
    }
    return this.nullableMap.get(name)
  }
  parse(inputter: Inputter) {
    return parse(this, inputter)
  }
}

function cartesian<T>(factors: T[][]): T[][] {
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

function nullableMap(grammar: Grammar) {
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
  const nullableMap = new Map<string, [Productor, Node][]>()
  for (const [name, set] of map) {
    if (set.size === 0) continue
    nullableMap.set(name, [...set].map(productor => [productor, {} as Node]))
  }
  for (const [name, nodes] of nullableMap) {
    for (const [productor, node] of nodes) {
      node.name = name
      if (productor.tokens.length === 0) {
        node.branches = [{
          branch: productor,
          nodes: [],
        }]
      } else {
        const tokens = productor.tokens.map(token => nullableMap.get(token.token))
        node.branches = cartesian(tokens).map(zip => ({
          branch: productor,
          nodes: zip.map(([, node]) => node)
        }))
      }
    }
  }
  const result =  new Map<string, Node[]>()
  for (const [name, nodes] of nullableMap) {
    result.set(name, nodes.map(([, node]) => node))
  }
  return result
}
