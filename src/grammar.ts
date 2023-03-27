import { parse, Input, ParseNode, Inputter } from './parse'
import { nullableMap } from './utils'

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

export class Productor<C = unknown, P extends unknown[] = []> {
  tokens: Token[] = []
  accept: (...args: any[]) => any
  choose: (node: ParseNode) => (Input | ParseNode)[]
  constructor(
    public name: string,
    public id: number,
    public grammar: Grammar,
  ) {
    this.accept = (...args) => args[0]
    this.choose = (node) => node.branches[0]
  }
  t(token: string) {
    return this.term(token)
  }
  n(token: string) {
    return this.nonTerm(token)
  }
  term(token: string): Productor<C, [...P, Input]> {
    this.tokens.push({
      kind: TokenKind.Term,
      token,
    })
    return this as any
  }
  nonTerm(token: string): Productor<C, [...P, any]> {
    this.tokens.push({
      kind: TokenKind.NonTerm,
      token,
    })
    return this as any
  }
  bind(
    accept?: (...args: [...P, C]) => any,
    choose?: (node: ParseNode) => (Input | ParseNode)[],
  ) {
    if (accept) this.accept = accept
    if (choose) this.choose = choose
  }
}

export class Grammar<C = unknown> extends Map<string, Productor<C>[]> {
  productorCount = 0
  nullableMap: Map<string, Set<Productor>>
  constructor(public entry: string) {
    super()
  }
  p(name: string) {
    return this.productor(name)
  }
  productor(name: string): Productor<C> {
    this.nullableMap = null
    let productors = this.get(name)
    if (!productors) {
      productors = []
      this.set(name, productors)
    }
    const productor = new Productor<C>(name, this.productorCount++, this)
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
