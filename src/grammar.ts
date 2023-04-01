import { parse, Input, ParseNode, Inputter } from './parse'
import { nullableMap } from './utils'

export enum TokenKind {
  Term, NonTerm
}

export interface Term<T> {
  kind: TokenKind.Term
  token: T
}

export interface NonTerm {
  kind: TokenKind.NonTerm
  token: string
}

export type Token<T> = Term<T> | NonTerm

export class Productor<T = unknown, C = unknown, P extends unknown[] = []> {
  tokens: Token<T>[] = []
  accept: (...args: any[]) => any
  choose: (node: ParseNode<T>) => (Input | ParseNode<T>)[]
  constructor(
    public name: string,
    public id: number,
    public grammar: Grammar,
  ) {
    this.accept = (...args) => args[0]
    this.choose = (node) => node.branches[0]
  }
  t(token: T) {
    return this.term(token)
  }
  n(token: string) {
    return this.nonTerm(token)
  }
  term(token: T): Productor<T, C, [...P, Input]> {
    this.tokens.push({
      kind: TokenKind.Term,
      token,
    })
    return this as any
  }
  nonTerm(token: string): Productor<T, C, [...P, any]> {
    this.tokens.push({
      kind: TokenKind.NonTerm,
      token,
    })
    return this as any
  }
  bind(
    accept?: (...args: [...P, C]) => any,
    choose?: (node: ParseNode<T>) => (Input | ParseNode<T>)[],
  ) {
    if (accept) this.accept = accept
    if (choose) this.choose = choose
  }
}

export class Grammar<T = unknown, C = unknown> extends Map<string, Productor<T, C>[]> {
  productorCount = 0
  nullableMap: Map<string, Set<Productor>>
  constructor(public entry: string) {
    super()
  }
  p(name: string) {
    return this.productor(name)
  }
  productor(name: string): Productor<T, C> {
    this.nullableMap = null
    let productors = this.get(name)
    if (!productors) {
      productors = []
      this.set(name, productors)
    }
    const productor = new Productor<T, C>(name, this.productorCount++, this)
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
  parse(inputter: Inputter<T>, equals: (text: string, token: T) => boolean) {
    return parse(this, inputter, equals)
  }
}
