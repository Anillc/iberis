import { Grammar } from './grammar'
export * from './grammar'

const g = new Grammar('S')
g.p('S').n('A')
g.p('A').n('B')
g.p('B').t('t')

const stack = ['t']

g.parse((type) => {
  console.log(type)
  return { term: stack.shift() }
})