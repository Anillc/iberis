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
  constructor(public name: string) {}
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
}

export class Grammar {
  productors: Productor[] = []
  constructor(public entry: string) {}
  p = this.productor
  productor(name: string) {
    const productor = new Productor(name)
    this.productors.push(productor)
    return productor
  }
}
