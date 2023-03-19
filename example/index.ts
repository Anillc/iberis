import { Grammar, Input, simpleLexer, Node, Productor, TokenKind } from '../src'
import { toFile } from 'ts-graphviz/adapter'

declare module '../src' {
  interface Node {
    print?: string
  }
  interface Input {
    print?: string
  }
}

const g = new Grammar('sum')
g.p('sum').n('sum').t(/[+-]/).n('product')
g.p('sum').n('product')
g.p('product').n('product').t(/[*/]/).n('factor')
g.p('product').n('factor')
g.p('factor').t('(').n('sum').t(')')
g.p('factor').t(/\d+(\.\d+)?/)
g.p('factor').t(/[a-zA-Z_][a-zA-Z0-9_]*/)
g.p('factor').t(/"(?!\\").+"/)

const input = '"www" + 1 * (114 + 514) / 1919.810'

const root = g.parse(simpleLexer(g, input))

function isNode(node: Input | Node): node is Node {
  return !node['term']
}

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
function dot(node: Node, results: string[]): string {
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
      if (isNode(next)) {
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
  dot({
    productor: { name: 'root' } as Productor,
    start: 0,
    next: 0,
    branches: root.map(n => [n])
  }, results)
  await toFile(`digraph { ${results.join('; ')} }`, 'root.svg', {})
})()