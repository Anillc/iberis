import { parse, Inputter } from './parse'
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
  nullableMap: Map<string, Set<Productor>>
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
