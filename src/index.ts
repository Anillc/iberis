import { Grammar } from './grammar'
export * from './grammar'

const g = new Grammar('S')
g.p('S').n('A')
g.p('A').t('t')
g.p('A')

const stack = ['t']

g.parse((type) => {
  if (stack[0] !== type) return null
  return { term: stack.shift() }
})