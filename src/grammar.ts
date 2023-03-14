import { parse, Texter } from './parse'

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
}

export class Grammar extends Map<string, Productor[]> {
  productorCount = 0
  nullableMap: Map<string, Set<Productor>>
  constructor(public entry: string) {
    super()
  }
  p = this.productor
  productor(name: string) {
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
      const productors = [...this.values()].flat()
      const map = new Map<string, Set<Productor>>
      productors.forEach(productor => map.set(productor.name, new Set()))
      let updated = true
      while (updated) {
        updated = false
        for (const productor of productors) {
          const set = map.get(productor.name)
          if (productor.tokens.length === 0) {
            if (!set.has(productor)) {
              set.add(productor)
              updated = true
            }
            continue
          }
          let nullable = true
          for (const token of productor.tokens) {
            if (token.kind === TokenKind.Term) {
              nullable = false
              break
            } else {
              if (map.get(token.token).size === 0) {
                nullable = false
                break
              }
            }
          }
          if (nullable && !set.has(productor)) {
            set.add(productor)
            continue
          }
        }
      }
      this.nullableMap = map
    }
    return this.nullableMap.get(name)
  }
  parse(texter: Texter) {
    return parse(this, texter)
  }
}
