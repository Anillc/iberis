# iberis

```typescript
import { accept, template, lexer } from 'iberis'

const [context, t] = template('sum')
t`sum     -> sum /[+-]/ product`    .bind((x, op, y) => op.text === '+' ? x + y : x - y)
t`sum     -> product`
t`product -> product /[*\/]/ factor`.bind((x, op, y) => op.text === '*' ? x * y : x / y)
t`product -> factor`
t`factor  -> '(' sum ')'`           .bind((_, sum) => sum)
t`factor  -> /\d+(?:\.\d+)?/`       .bind((num) => +num.text)
t`factor  -> /"(?:[^"\\]|\\.)*"/`   .bind((str) => str.text.substring(1, str.text.length - 1).replaceAll('\\\\', '\\').replaceAll('\\"', '"'))

const input = '233 * (114 + 514) / 1919.810 + "www"'
const root = context.grammar.parse(lexer(context, input))
console.log(accept(root[0]))
// output: 76.2179590688662www
```