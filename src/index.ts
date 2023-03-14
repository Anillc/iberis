import { Grammar } from './grammar'
export * from './grammar'

const g = new Grammar('S')
g.p('S').n('A').n('A')
g.p('A')

const stack = []

g.parse((type) => {
  console.log(type)
  return { term: stack.shift() }
})