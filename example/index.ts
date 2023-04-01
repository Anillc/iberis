import { Grammar, ParseNode, Productor, TokenKind, accept, isParsingNode, s } from '../src'
import { toFile } from 'ts-graphviz/adapter'

declare module '../src' {
  interface ParseNode<T> {
    print?: string
  }
  interface Input {
    print?: string
  }
}

const grammar = new Grammar<string | RegExp>('sum')
const t = s.template(grammar)
t`sum     -> sum /[+-]/ product`    .bind((x, op, y) => op.text === '+' ? x + y : x - y)
t`sum     -> product`
t`product -> product /[*\/]/ factor`.bind((x, op, y) => op.text === '*' ? x * y : x / y)
t`product -> factor`
t`factor  -> '(' sum ')'`           .bind((_, sum) => sum)
t`factor  -> /\d+(?:\.\d+)?/`       .bind((num) => +num.text)
t`factor  -> /"(?:[^"\\]|\\.)*"/`   .bind((str) => str.text.substring(1, str.text.length - 1).replaceAll('\\\\', '\\').replaceAll('\\"', '"'))

const input = '233 * (114 + 514) / 1919.810 + "www"'

const root = grammar.parse(s.lexer(input), s.equals)

function productorToString(productor: Productor<string | RegExp>) {
  if (productor.name === 'root') {
    return 'root'
  }
  return `${productor.name} -> ${productor.tokens.map(token => {
    if (token.kind === TokenKind.Term) {
      if (typeof token.token === 'string') {
        return token.token
      } else {
        return token.token.source
      }
    } else {
      return token.token
    }
  }).join(' ')}`
}

let id = 0
function dot(node: ParseNode<string | RegExp>, results: string[]): string {
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
  pushLabel(node.print, productorToString(node.productor))
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
        const name = dot(next, results)
        pushEdge(fork, name)
      } else {
        if (!next.print) next.print = `${next.text}:${id++}`
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
    dot(node, results)
  }
  await toFile(`digraph { ${results.join('; ')} }`, 'root.svg', {})
})()