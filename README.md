AnimatedTransition
===

Animated add and remove children in React
---

I wrote this solution because all existing solutions like `react motion` or
`TeactTransitionGroup` are unnecessarily verbose and ugly for such a simple
task.

`<AnimatedTransition>` It is a React component that:

1. Watches for changes in its children
2. If element was removed? automatically passes the necessary
   `exitProps` or `exitClass` to child
3. Waits for the CSS transition animation to complete, and then removes the
   element or component from the DOM.
4. If CSS transition animations are missing, the
   element is removed from the DOM after `forceRemoveTimeout` is time.

This allows you to create animated transitions between pages, animatedly
remove list items, animatedly switch items from one to another, etc.

For the entry animation, use css `@starting-style { }`.

List example:
---

```jsx 
const Parent = () => {
  const [items, setItems] = useState([1, 2, 3])

  return (
    <ul>
      <AnimatedTransition exitClass="exit">
        {items.map(item => (
          <li key={item} className="item">{item}</li>
        ))}
      </AnimatedTransition>
    </ul>
  )
}

```

```css
.item {
    .item {
        /* for animate to height:auto */
        interpolate-size: allow-keywords;
        transition: 1s;

        &.exit {
            height: 0;
        }
    }

}
```

Switch example:
---

We should pass the `key` prop so that the component can distinguish
children
from each other. In case of switching between pages, this can be their
partial url, in case of images src. In general, this is a common rule
of React.

```jsx 
const Parent = () => {
  const [active, setActive] = useState(false)

  return <div>
    <AnimatedTransition exitClass="exit">
      {active ?
        <div className="item" key={1}>One</div> :
        <div className="item" key={2}>Second</div>}
    </AnimatedTransition>
  </div>
}
```

One component no needs a `key` prop:

```jsx 
const Parent = () => {
  const [active, setActive] = useState(false)

  return <div>
    <AnimatedTransition exitClass="exit">
      {active && <div className="item"></div>}
    </AnimatedTransition>
  </div>
}
```

If you use Component in children, you must ensure that the `ref` prop is
passed, otherwise `AnimatedTransition` will not be able to track the
completion of the transition animation, and will remove the element
after the `forceRemoveTimeout` time has passed. `exitProps` will be merged
with the normal `props` you pass to children, but will override them

```js
const passedProps = {
  ...props,
  ...exitProps,
  className: merge(props.className, exitProps.className)
}
```

`className` will be merged for humanitarian reasons =)

```jsx 
const Parent = () => {
  const [active, setActive] = useState(false)

  return <div>
    <AnimatedTransition exitProps={{ exit: true }}>
      {active && <Chat />}
    </AnimatedTransition>
  </div>
}

const Chat = ({ exit, ref }) => {

  return <div ref={ref} className={`chat ${exit ? 'exit' : ''}`}>
    Chat
  </div>
}
```

This is done exactly so that you can decide for yourself how to display its
disappearance animation inside the component, and also so that the
component knows that it is in the disappearance animation, and possibly
stops some of its processes, and did not respond to user actions for
example.


If you have already passed some ref prop from the top parent, it will be
overwritten, and your outer component will think that the element is
unmounted (although it will physically animate and be present in the DOM)

If you don't like props, you can use context with `exitContext` prop:

```jsx
import { useExitContext } from 'react-animated-transition'

const Parent = () => {
  const [active, setActive] = useState(false)

  return <div>
    <AnimatedTransition exitContext={{ exit: true }}>
      {active && <Chat />}
    </AnimatedTransition>
  </div>
}

const Chat = () => {
  const [{exit}, ref] = useExitContext()

  return <div ref={ref} className={`chat ${exit ? 'exit' : ''}`}>
    Chat
  </div>
}

// For rendered components both values of tuple will be undefined, 
// so you can set a default value so that destructuring doesn't break:
const Chat = () => {
  const [{exit}, ref] = useExitContext({exit: false})

  return <div ref={ref} className={`chat ${exit ? 'exit' : ''}`}>
    Chat
  </div>
}
```


If you need to temporarily disable the component, do it:

```jsx
<AnimatedTransition disabled={true}></AnimatedTransition>
```

P.S.
---
In the future, I plan to add animated CSS changes to the order of list
elements, passing either `css variables` or some props to the child
elements that would provide information about the previous position of the
element, its previous ordinal number, possibly about previous sizes. Or
I'll make all this customizable through the AnimatedTransition settings,
make different profiles, and a cool animation by default. 


please star my repository so i can brag to my girlfriend
