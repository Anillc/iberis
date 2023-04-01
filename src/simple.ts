import { Grammar, Productor } from './grammar'
import { Input } from './parse'
import { accept } from './utils'

export interface ParseContext {
  grammar: Grammar
  termId?: number
  terms: Map<string, string | RegExp>
}

const templateTerms = new Map<string, string | RegExp>()
templateTerms.set('quote1', /"(?:[^"\\]|\\.)*"/)
templateTerms.set('quote2', /'(?:[^'\\]|\\.)*'/)
templateTerms.set('regex', /\/(?:[^\/\\]|\\.)*\//)
templateTerms.set('id', /[a-zA-Z_][a-zA-Z0-9_]*/)
templateTerms.set('arrow', '->')

const templateGrammar = new Grammar<ParseContext>('productor')
templateGrammar.p('productor').n('id').t('arrow').n('tokens').bind((id, _, tokens, context) => {
  const productor = context.grammar.productor(id)
  for (const token of tokens) {
    if (token.type === 'term') {
      const existed = [...context.terms.entries()].find(([, term]) => {
        if (term instanceof RegExp && token.match instanceof RegExp) {
          return term.source === token.match.source
        } else {
          return term === token.match
        }
      })
      if (!existed) {
        const termId = `l${context.termId++}`
        context.terms.set(termId, token.match)
        productor.t(termId)
      } else {
        productor.t(existed[0])
      }
    } else {
      productor.n(token.name)
    }
  }
  return productor
})
templateGrammar.p('productor').n('id').t('arrow').bind((id, _, context) => context.grammar.productor(id))
templateGrammar.p('tokens').n('tokens').n('token').bind((tokens, token) => tokens.concat(token))
templateGrammar.p('tokens').n('token').bind((token) => [token])
templateGrammar.p('token').nonTerm('id').bind((name) => ({ type: 'nonTerm', name }))
templateGrammar.p('token').t('quote1').bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll('\\"', '"')
  return { type: 'term', match: term }
})
templateGrammar.p('token').t('quote2').bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll("\\'", "'")
  return { type: 'term', match: term }
})
templateGrammar.p('token').t('regex').bind(({ text }) => {
  const regex = text.substring(1, text.length - 1)
  return { type: 'term', match: new RegExp(regex) }
})
templateGrammar.p('id').t('id').bind(({ text }) => text)

const templateContext: ParseContext = {
  grammar: templateGrammar,
  termId: 0,
  terms: templateTerms,
}

export function template<C>(
  entry: string
): [ParseContext, (input: string | TemplateStringsArray) => Productor<C, any[]>] {
  const context: ParseContext = {
    grammar: new Grammar(entry),
    termId: 0,
    terms: new Map(),
  }
  return [context, (input) => {
    const text = Array.isArray(input)
      ? String.raw(input as TemplateStringsArray)
      : input as string
    const lines = text.split('\n')
    let last: Productor
    for (const line of lines) {
      if (line.trim() === '') continue
      const root = templateGrammar.parse(lexer(templateContext, line))
      if (root.length !== 1) {
        throw new Error('failed to parse productor expression')
      }
      last = accept(root[0], context)
    }
    return last as any
  }]
}

export function lexer(context: ParseContext, input: string) {
  const string: string[] = []
  const regexp: string[] = []
  for (const [name, value] of context.terms) {
    if (typeof value === 'string') {
      string.push(`(?<${name}>(${value.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')}))`)
    } else {
      regexp.push(`(?<${name}>(${value.source}))`)
    }
  }
  const stringRegex = new RegExp(`^(${string.join('|')})`)
  const regexpRegex = new RegExp(`^(${regexp.join('|')})`)
  const tokens: Input[] = []
  let rest = input
  while (true) {
    rest = rest.trimStart()
    if (rest === '') break
    const result = stringRegex.exec(rest) || regexpRegex.exec(rest)
    if (!result) {
      throw new Error(`Unexpected input at ${input.length - rest.length}`)
    }
    let token: Input
    for (const [name, text] of Object.entries(result.groups)) {
      if (!text) continue
      if (!token) {
        token = { term: name, text }
        continue
      }
      if (text.length > token.text.length) {
        token = { term: name, text }
      }
    }
    if (token.text.length === 0) {
      throw new Error(`Empty terminal token detected, check your grammar. At ${input.length - rest.length}`)
    }
    rest = rest.substring(token.text.length)
    tokens.push(token)
  }
  return () => tokens.shift()
}
