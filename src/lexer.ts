import { Grammar } from './grammar'
import { Input } from './parse'
import { isTerm } from './utils'

export function simpleLexer(grammar: Grammar, input: string) {
  const terms = [...grammar.values()]
    .map(productors => productors.map(productor => productor.tokens))
    .flat(2).filter(isTerm)
    .map(term => {
      const match = typeof term.match === 'string'
        ? term.match.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
        : term.match.source
      return `(?<${term.token}>(${match}))`
    })
  const regex = new RegExp(`^(${terms.join('|')})`)
  const tokens: Input[] = []
  let rest = input
  while (true) {
    rest = rest.trimStart()
    if (rest === '') break
    const result = regex.exec(rest)
    if (!result) {
      throw new Error(`Unexpected input at ${input.length - rest.length}`)
    }
    let token: Input
    for (const [name, text] of Object.entries(result.groups)) {
      if (!text || !name.startsWith('__LEXER_')) continue
      if (!token) {
        token = { term: name, text, groups: result.groups }
        continue
      }
      if (text.length > token.text.length) {
        token = { term: name, text, groups: result.groups }
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
