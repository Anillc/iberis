import { simpleLexer } from './lexer'
import { parse, Input, ParsingNode, Inputter } from './parse'
import { accept, isParsingNode, nullableMap } from './utils'

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

export class Productor<C = unknown, T extends unknown[] = []> {
  tokens: Token[] = []
  accept: (...args: any[]) => any
  choose: (node: ParsingNode) => (Input | ParsingNode)[]
  constructor(
    public name: string,
    public id: number,
    public grammar: Grammar,
  ) {
    this.accept = (...args) => args[0]
    this.choose = (node) => node.branches[0]
  }
  t(match: string | RegExp) {
    return this.term(match)
  }
  n(token: string) {
    return this.nonTerm(token)
  }
  term(match: string | RegExp, token?: string): Productor<C, [...T, Input]> {
    if (typeof match === 'string') {
      token ||= this.grammar.stringTerms.get(match)
      if (!token) {
        token = `__LEXER_${this.grammar.termCount++}`
        this.grammar.stringTerms.set(match, token)
      }
    } else {
      token ||= this.grammar.regexTerms.get(match.source)
      if (!token) {
        token = `__LEXER_${this.grammar.termCount++}`
        this.grammar.regexTerms.set(match.source, token)
      }
    }
    this.tokens.push({
      kind: TokenKind.Term,
      token, match,
    })
    return this as any
  }
  nonTerm(token: string): Productor<C, [...T, any]> {
    this.tokens.push({
      kind: TokenKind.NonTerm,
      token,
    })
    return this as any
  }
  bind(
    accept?: (...args: [...T, C]) => any,
    choose?: (node: ParsingNode) => (Input | ParsingNode)[],
  ) {
    if (accept) this.accept = accept
    if (choose) this.choose = choose
  }
}

export class Grammar<C = unknown> extends Map<string, Productor[]> {
  productorCount = 0
  termCount = 0
  stringTerms = new Map<string, string>()
  regexTerms = new Map<string, string>()
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
  t(input: string | TemplateStringsArray): Productor<C, any[]> {
    const text = Array.isArray(input)
      ? String.raw(input as TemplateStringsArray)
      : input as string
    const lines = text.split('\n')
    let last: Productor
    for (const line of lines) {
      if (line.trim() === '') continue
      last = parseTemplate(this, line)
    }
    return last as any
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

const template = new Grammar<Grammar>('productor')
template.p('productor').n('id').t('->').n('tokens').bind((id, _, tokens, grammar) => {
  const productor = grammar.productor(id)
  for (const token of tokens) {
    if (token.type === 'term') {
      productor.t(token.match)
    } else {
      productor.n(token.name)
    }
  }
  return productor
})
template.p('productor').n('id').t('->').bind((id, _, grammar) => grammar.productor(id))
template.p('tokens').n('tokens').n('token').bind((tokens, token) => tokens.concat(token))
template.p('tokens').n('token').bind((token) => [token])
template.p('token').nonTerm('id').bind((name) => ({ type: 'nonTerm', name }))
template.p('token').t(/"(?:[^"\\]|\\.)*"/).bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll('\\"', '"')
  return { type: 'term', match: term }
})
template.p('token').t(/'(?:[^'\\]|\\.)*'/).bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll("\\'", "'")
  return { type: 'term', match: term }
})
template.p('token').t(/\/(?:[^\/\\]|\\.)*\//).bind(({ text }) => {
  const regex = text.substring(1, text.length - 1)
  return { type: 'term', match: new RegExp(regex) }
})
template.p('id').t(/[a-zA-Z_][a-zA-Z0-9_]*/).bind(({ text }) => text)

function parseTemplate(grammar: Grammar, input: string) {
  const root = template.parse(simpleLexer(template, input))
  if (root.length !== 1) {
    throw new Error('failed to parse productor expression')
  }
  return accept(root[0], grammar)
}
