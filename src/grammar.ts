import { simpleLexer } from './lexer'
import { parse, Input, Inputter, Node } from './parse'
import { nullableMap } from './utils'

export enum TokenKind {
  Term, NonTerm
}

export interface Term {
  kind: TokenKind.Term
  token: string
  match?: string | RegExp
}

export interface NonTerm {
  kind: TokenKind.NonTerm
  token: string
}

export type Token = Term | NonTerm

export class Productor {
  tokens: Token[] = []
  isAccept = false
  constructor(
    public name: string,
    public id: number,
    public grammar: Grammar,
  ) {}
  term(match: string | RegExp) {
    let token: string
    if (typeof match === 'string') {
      token = this.grammar.stringTerms.get(match)
      if (!token) {
        token = `__LEXER_${this.grammar.termCount++}`
        this.grammar.stringTerms.set(match, token)
      }
    } else {
      token = this.grammar.regexTerms.get(match.source)
      if (!token) {
        token = `__LEXER_${this.grammar.termCount++}`
        this.grammar.regexTerms.set(match.source, token)
      }
    }
    this.tokens.push({
      kind: TokenKind.Term,
      token, match,
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
  termCount = 0
  stringTerms = new Map<string, string>()
  regexTerms = new Map<string, string>()
  nullableMap: Map<string, Set<Productor>>
  constructor(public entry: string) {
    super()
  }
  productor(name: string) {
    this.nullableMap = null
    let productors = this.get(name)
    if (!productors) {
      productors = []
      this.set(name, productors)
    }
    const productor = new Productor(name, this.productorCount++, this)
    productors.push(productor)
    return productor
  }
  p(input: string | TemplateStringsArray) {
    const text = Array.isArray(input)
      ? String.raw(input as TemplateStringsArray)
      : input as string
    return parseProductor(this, text)
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

const productorGrammar = new Grammar('productor')
productorGrammar.productor('productor').nonterm('id').term('->').nonterm('tokens')
const empty = productorGrammar.productor('productor').nonterm('id').term('->')
const tokens1 = productorGrammar.productor('tokens').nonterm('tokens').nonterm('token')
const tokens2 = productorGrammar.productor('tokens').nonterm('token')
const nonTerm = productorGrammar.productor('token').nonterm('id')
const quote1 = productorGrammar.productor('token').term(/"(?:[^"\\]|\\.)*"/)
const quote2 = productorGrammar.productor('token').term(/'(?:[^'\\]|\\.)*'/)
const regex = productorGrammar.productor('token').term(/\/(?:[^\/\\]|\\.)*\//)
productorGrammar.productor('id').term(/[a-zA-Z_][a-zA-Z0-9_]*/)

function parseProductor(grammar: Grammar, input: string) {
  const root = productorGrammar.parse(simpleLexer(productorGrammar, input))
  if (root.length !== 1) {
    throw new Error('failed to parse productor expression')
  }
  const branch = root[0].branches[0]
  const productor = grammar.productor(((branch[0] as Node).branches[0][0] as Input).text)
  if (root[0].productor === empty) {
    return productor
  }
  let tokens = branch[2] as Node
  while (tokens) {
    let token: Node
    if (tokens.productor === tokens1) {
      token = tokens.branches[0][1] as Node
      tokens = tokens.branches[0][0] as Node
    } else if (tokens.productor === tokens2) {
      token = tokens.branches[0][0] as Node
      tokens = null
    } else {
      throw new Error('unknown productor')
    }
    if (token.productor === nonTerm) {
      productor.nonterm(((token.branches[0][0] as Node).branches[0][0] as Input).text)
    } else if (token.productor === quote1) {
      let text: string = (token.branches[0][0] as Input).text
      text = text.substring(1, text.length - 1).replaceAll('\\\\', '\\').replaceAll('\\"', '"')
      productor.term(text)
    } else if (token.productor === quote2) {
      let text: string = (token.branches[0][0] as Input).text
      text = text.substring(1, text.length - 1).replaceAll('\\\\', '\\').replaceAll("\\'", "'")
      productor.term(text)
    } else if (token.productor === regex) {
      let text: string = (token.branches[0][0] as Input).text
      text = text.substring(1, text.length - 1)
      productor.term(new RegExp(text))
    } else {
      throw new Error('unknown productor')
    }
  }
  productor.tokens.reverse()
  return productor
}
