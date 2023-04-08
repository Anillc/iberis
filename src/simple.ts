import { Grammar, Productor, Term } from './grammar'
import { Input, Item } from './parse'
import { accept } from './utils'

export namespace simple {

  export type TermType = string | RegExp

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
        const root = templateGrammar.parse(lexer(line), equals)
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
    return (items: Item<TermType>[]): [Item<TermType>[], Input] => {
      rest = rest.trim()
      if (!rest) return null
      let input: Input
      let current: TermType
      for (const item of items) {
        const { token } = item.productor.tokens[item.point] as Term<TermType>
        const matched = match(rest, token)
        if (!matched) continue
        if (typeof current === typeof token) {
          // compare length when type is the same
          // longer string has higher priority
          // short result of regex has higher priority
          if (typeof token === 'string' && matched.length > input.text.length) {
            if (matched.length > input.text.length) {
              input = { text: matched }
              current = token
            }
          } else {
            if (matched.length < input.text.length) {
              input = { text: matched }
              current = token
            }
          }
        } else {
          if (!input) {
            input = { text: matched }
            current = token
          } else {
            // string has higher priority when type is different
            if (typeof token === 'string') {
              input = { text: matched }
              current = token
            }
          }
        }
      }
      if (!input) return [[], null]
      rest = rest.substring(input.text.length)
      const nextItems: Item<TermType>[] = []
      for (const item of items) {
        const { token } = item.productor.tokens[item.point] as Term<TermType>
        if (equals(input.text, token)) {
          nextItems.push(item)
        }
      }
      return [nextItems, input]
    }
  }

  export function equals(text: string, token: TermType) {
    if (typeof token === 'string') {
      return text === token
    } else {
      return new RegExp(`^${token.source}`).test(text)
    }
  }

  export function match(text: string, token: TermType): string {
    if (typeof token === 'string') {
      if (text.startsWith(token)) {
        return token
      }
    } else {
      return new RegExp(`^(${token.source})`).exec(text)?.[1]
    }
  }

}

export { simple as s }
