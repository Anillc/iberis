import { isParsingNode, Grammar, ParsingNode, Productor, TokenKind, accept, simpleLexer, Input } from '../src'
import { toFile } from 'ts-graphviz/adapter'

declare module '../src' {
  interface ParsingNode {
    print?: string
  }
  interface Input {
    print?: string
  }
}

const g = new Grammar('sum')
g.t`sum -> sum /[+-]/ product`.bind((x, op, y) => op.text === '+' ? x + y : x - y)
g.t`sum -> product`
g.t`product -> product /[*\/]/ factor`.bind((x, op, y) => op.text === '*' ? x * y : x / y)
g.t`product -> factor`
g.t`factor -> '(' sum ')'`
g.t`factor -> /\d+(?:\.\d+)?/`.bind((num) => +num.text)
g.t`factor -> /"(?:[^"\\]|\\.)*"/`.bind((str) => str.text.substring(1, str.text.length - 1).replaceAll('\\\\', '\\').replaceAll('\\"', '"'))

const input = '233 * (114 + 514) / 1919.810 + "www"'

const root = g.parse(simpleLexer(g, input))

console.log(accept(root[0]));

function productorToString(productor: Productor) {
  if (productor.name === 'root') {
    return 'root'
  }
  return `${productor.name} -> ${productor.tokens.map(token => {
    if (token.kind === TokenKind.Term) {
      if (typeof token.match === 'string') {
        return token.match
      } else {
        return token.match.source
      }
    } else {
      return token.token
    }
  }).join(' ')}`
}

let id = 0
function dot(node: ParsingNode, results: string[]): string {
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
        if (!next.print) next.print = `${next.term}:${id++}`
        pushLabel(next.print, next.text)
        pushEdge(fork, next.print)
      }
    }
  }
  return node.print
}


;(async () => {
  const results = []
  for (const node of root) {
    dot(node, results)
  }
  await toFile(`digraph { ${results.join('; ')} }`, 'root.svg', {})
})()