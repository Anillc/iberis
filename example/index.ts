import { isParsingNode, ParseNode, Productor, TokenKind, accept, template, lexer, ParseContext } from '../src'
import { toFile } from 'ts-graphviz/adapter'

declare module '../src' {
  interface ParseNode {
    print?: string
  }
  interface Input {
    print?: string
  }
}

const [context, t] = template('sum')
t`sum -> sum /[+-]/ product`.bind((x, op, y) => op.text === '+' ? x + y : x - y)
t`sum -> product`
t`product -> product /[*\/]/ factor`.bind((x, op, y) => op.text === '*' ? x * y : x / y)
t`product -> factor`
t`factor -> '(' sum ')'`.bind((_, sum) => sum)
t`factor -> /\d+(?:\.\d+)?/`.bind((num) => +num.text)
t`factor -> /"(?:[^"\\]|\\.)*"/`.bind((str) => str.text.substring(1, str.text.length - 1).replaceAll('\\\\', '\\').replaceAll('\\"', '"'))

const input = '233 * (114 + 514) / 1919.810 + "www"'

const root = context.grammar.parse(lexer(context, input))

function productorToString(productor: Productor, context: ParseContext) {
  if (productor.name === 'root') {
    return 'root'
  }
  return `${productor.name} -> ${productor.tokens.map(token => {
    if (token.kind === TokenKind.Term) {
      const match = context.terms.get(token.token)
      if (typeof match === 'string') {
        return match
      } else {
        return match.source
      }
    } else {
      return token.token
    }
  }).join(' ')}`
}

let id = 0
function dot(node: ParseNode, results: string[], context: ParseContext): string {
  function pushEdge(a: string, b: string) {
    results.push(`"${a.replaceAll('"', '\\"')}" -> "${b.replaceAll('"', '\\"')}"`)
  }
  function pushLabel(a: string, label: string) {
    results.push(`"${a.replaceAll('"', '\\"')}" [label = "${label.replaceAll('"', '\\"')}"]`)
  }
  function pushShape(a: string, shape: string) {
    results.push(`"${a.replaceAll('"', '\\"')}" [shape = "${shape.replaceAll('"', '\\"')}"]`)
  }
  if (node.print) return node.print
  node.print = `${node.productor.name}:${id++}`
  pushLabel(node.print, productorToString(node.productor, context))
  let forks = 0
  for (const branch of node.branches) {
    let fork: string
    if (node.branches.length === 1) {
      fork = node.print
    } else {
      fork = `${node.print}-${forks++}`
      pushShape(fork, 'point')
      pushEdge(node.print, fork)
    }
    for (const next of branch) {
      if (isParsingNode(next)) {
        const name = dot(next, results, context)
        pushEdge(fork, name)
      } else {
        if (!next.print) next.print = `${next.term}:${id++}`
        pushLabel(next.print, next.text)
        pushEdge(fork, next.print)
      }
    }
  }
  return node.print
}


;(async () => {
  console.log(accept(root[0]))
  const results = []
  for (const node of root) {
    dot(node, results, context)
  }
  await toFile(`digraph { ${results.join('; ')} }`, 'root.svg', {})
})()