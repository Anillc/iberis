import { Grammar, Productor, Term } from './grammar'
import { Input, Item } from './parse'
import { accept } from './utils'

type TermType = string | RegExp

const templateGrammar = new Grammar<TermType, Grammar>('productor')
templateGrammar.p('productor').n('id').t('->').n('tokens').bind((id, _, tokens, grammar) => {
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
templateGrammar.p('productor').n('id').t('->').bind((id, _, grammar) => grammar.productor(id))
templateGrammar.p('tokens').n('tokens').n('token').bind((tokens, token) => tokens.concat(token))
templateGrammar.p('tokens').n('token').bind((token) => [token])
templateGrammar.p('token').nonTerm('id').bind((name) => ({ type: 'nonTerm', name }))
templateGrammar.p('token').t(/"(?:[^"\\]|\\.)*"/).bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll('\\"', '"')
  return { type: 'term', match: term }
})
templateGrammar.p('token').t(/'(?:[^'\\]|\\.)*'/).bind(({ text }) => {
  const term = text.substring(1, text.length - 1)
    .replaceAll('\\\\', '\\')
    .replaceAll("\\'", "'")
  return { type: 'term', match: term }
})
templateGrammar.p('token').t(/\/(?:[^\/\\]|\\.)*\//).bind(({ text }) => {
  const regex = text.substring(1, text.length - 1)
  return { type: 'term', match: new RegExp(regex) }
})
templateGrammar.p('id').t(/[a-zA-Z_][a-zA-Z0-9_]*/).bind(({ text }) => text)

export function template<C>(
  grammar: Grammar<TermType, C>
): (input: string | TemplateStringsArray) => Productor<TermType, C, any[]> {
  return (input) => {
    const text = Array.isArray(input)
      ? String.raw(input as TemplateStringsArray)
      : input as string
    const lines = text.split('\n')
    let last: Productor
    for (const line of lines) {
      if (line.trim() === '') continue
      const root = templateGrammar.parse(lexer(line))
      if (root.length !== 1) {
        throw new Error('failed to parse productor expression')
      }
      last = accept(root[0], grammar)
    }
    return last as any
  }
}

export function lexer(input: string) {
  let rest = input
  return (items: Item<TermType>[]): [Item<TermType>[], Input<TermType>] => {
    rest = rest.trim()
    if (!rest) return [[], null]
    let input: Input<TermType>
    for (const item of items) {
      const { token } = item.productor.tokens[item.point] as Term<TermType>
      if (typeof token === 'string') {
        if (!rest.startsWith(token)) continue
        if (!input || token.length > input.text.length) {
          input = { token, text: token }
        }
      } else {
        const match = new RegExp(`^(${token.source})`).exec(rest)
        if (!match) continue
        if (!input || match[1].length > input.text.length) {
          input = { token, text: match[1] }
        }
      }
    }
    if (!input) return [[], null]
    rest = rest.substring(input.text.length)
    const nextItems: Item<TermType>[] = []
    for (const item of items) {
      const { token } = item.productor.tokens[item.point] as Term<TermType>
      if (typeof token === 'string') {
        if (token === input.text) {
          nextItems.push(item)
        }
      } else {
        if (new RegExp(`^(${token.source})`).test(input.text)) {
          nextItems.push(item)
        }
      }
    }
    return [nextItems, input]
  }
}
