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
  nullableMap: Map<string, boolean>
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
      // undefined for unknown
      const numberMap = new Map<number, boolean>()
      const nameMap = new Map<string, boolean>()
      const productors = [...this.values()].flat()
      while (productors.some(productor => numberMap.get(productor.id) === undefined)) {
        for (const productor of productors) {
          if (numberMap.get(productor.id) !== undefined) continue
          const settled = nameMap.get(productor.name)
          if (settled !== undefined) {
            numberMap.set(productor.id, settled)
            continue
          }
          if (productor.tokens.length === 0) {
            nameMap.set(productor.name, true)
            numberMap.set(productor.id, true)
            continue
          }
          let nullable = true
          for (const token of productor.tokens) {
            if (token.kind === TokenKind.NonTerm) {
              const tokenNullable = nameMap.get(token.token)
              if (tokenNullable === undefined) {
                nullable = undefined
                break
              }
              if (!tokenNullable) {
                nameMap.set(productor.name, false)
                numberMap.set(productor.id, false)
                nullable = false
                break
              }
            } else {
              nameMap.set(productor.name, false)
              numberMap.set(productor.id, false)
              nullable = false
              break
            }
          }
          if (nullable === undefined) continue
          nameMap.set(productor.name, nullable)
          numberMap.set(productor.id, nullable)
        }
      }
      this.nullableMap = nameMap
    }
    return this.nullableMap.get(name)
  }
  parse(texter: Texter) {
    return parse(this, texter)
  }
}
