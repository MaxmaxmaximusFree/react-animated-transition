'use client'

import {
  Children,
  cloneElement,
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react'

type PersistProps = {
  className?: string
} & Record<string, any>

type Node = Omit<ReactElement<PersistProps>, 'key'> & {
  key: string
}

export type ExitAnimationDetectorRef = (
  element: HTMLElement | null
) => void

type Persist = {
  node: Node
  key: string
  ref: ExitAnimationDetectorRef
  prevKey: string | null
  nextKey: string | null
}

type ExitContextValueT<T = any> = T

type ExitContextTuple<T = any> = [
  ExitContextValueT<T>,
  ExitAnimationDetectorRef | undefined,
]

export interface AnimatedTransitionProps {
  children: any // FIX
  exitProps?: PersistProps
  exitContext?: ExitContextValueT
  exitClass?: string
  // если никакая анимация не началась, удалить элемент через:
  forceRemoveTimeout?: number
  disabled?: boolean
}

/////////////////////////////////////////////////////////////////////
// AnimatedTransition
/////////////////////////////////////////////////////////////////////
export const AnimatedTransition = ({
  exitProps = {},
  exitContext,
  exitClass,
  forceRemoveTimeout = 300,
  disabled = false,
  ...props
}: AnimatedTransitionProps): ReactNode => {
  // FIX: баг тайпскрипта, он не может нормально принимать ситуации
  // типа вот таких:
  // <Transition exitProps={{ exit: true }}>
  //    {models.map((model) => children(model as ModelT))}
  // </Transition>
  // По этому допускаем children:any а потом конвертируем в нормальный тип
  const children = Children.toArray(props.children) as Node[]

  if (exitClass) {
    exitProps.className = mergeClassNames(exitProps.className, exitClass)
  }

  const prevRender = useRef(children)
  const prevPersists = useRef<Persist[]>([])
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  const removePersist = useCallback((persist: Persist) => {
    prevRender.current = prevRender.current.filter(
      (node) => node.key !== persist.key
    )
    prevPersists.current = prevPersists.current.filter(
      (prevPersist) => prevPersist.key !== persist.key
    )
    forceUpdate()
  }, [])

  if (disabled) {
    return children
  }

  const persists = getPersists(
    prevRender.current,
    prevPersists.current,
    children,
    exitProps,
    removePersist,
    forceRemoveTimeout
  )

  const newRender = addPersists(children, persists)

  prevPersists.current = persists
  prevRender.current = newRender

  return wrapEveryNodeWithExitContext(newRender, persists, exitContext)
}

const addPersists = (children: Node[], persists: Persist[]) => {
  children = children.slice() // clone for mutate

  while (persists.length) {
    // Пытаемся вставить персисты на их примерно предыдущее положение,
    // прилепив их к предыдущим соседним нодам
    const addedPersists = tryAddPersistsSticky(children, persists)
    if (addedPersists.length) {
      persists = persists.filter(
        (persist) => !addedPersists.includes(persist)
      )
    } else {
      // Если не получилось прилепить ни один персист, то вставляем первый
      // в список детей. Возможно остальные персисты потом за него зацепятся,
      // и встанут так в нужном порядке
      const persist = persists.shift()!
      children.push(persist.node)
    }
  }

  return children
}

const tryAddPersistsSticky = (
  children: Node[],
  persists: Persist[]
): Persist[] => {
  const addedPersists: Persist[] = []

  for (const persist of persists) {
    const added = tryAddOnePersistSticky(children, persist)
    if (added) {
      addedPersists.push(persist)
    }
  }

  return addedPersists
}

const tryAddOnePersistSticky = (
  children: Node[],
  persist: Persist
): boolean => {
  // Если была с краю, то стремимся оставлять с краю
  if (persist.prevKey === null) {
    children.unshift(persist.node)
    return true
  }

  const prevIndex = getStickyIndexByKey(children, persist.prevKey)
  if (prevIndex !== -1) {
    children.splice(prevIndex + 1, 0, persist.node)
    return true
  }

  const nextIndex = getStickyIndexByKey(children, persist.nextKey)
  if (nextIndex !== -1) {
    children.splice(nextIndex, 0, persist.node)
    return true
  }

  return false
}

const getStickyIndexByKey = (
  nodes: Node[],
  key: string | null
): number => {
  if (key === null) return -1
  return getNodeIndexByKey(nodes, key)
}

const getNodeIndexByKey = (nodes: Node[], key: string): number => {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.key === key) {
      return index
    }
  }
  return -1
}

const getPersists = (
  prevRender: Node[],
  prevPersists: Persist[],
  children: Node[],
  exitProps: PersistProps,
  removePersist: (persist: Persist) => void,
  forceRemoveTimeout: number
): Persist[] => {
  const childrenKeys = children.map((node) => node.key)

  const persistByKey = new Map(
    prevPersists.map((persist) => [persist.key, persist])
  )

  const persists: Persist[] = []

  prevRender.forEach((node, index) => {
    if (childrenKeys.includes(node.key)) return

    const prevKey = prevRender[index - 1]?.key || null
    const nextKey = prevRender[index + 1]?.key || null

    // Если уже существует такой персист, то просто обновим его
    // соседей, чтобы он в новом списке рендерился примерно там же
    if (persistByKey.has(node.key)) {
      const persist = persistByKey.get(node.key)!
      persist.prevKey = prevKey
      persist.nextKey = nextKey
      persists.push(persist)
    } else {
      // Создаем новый персист, тут-то и происходит всё колдовство
      persists.push(
        createPersist(
          node,
          exitProps,
          prevKey,
          nextKey,
          forceRemoveTimeout,
          removePersist
        )
      )
    }
  })

  return persists
}

const createPersist = (
  node: Node,
  exitProps: PersistProps,
  prevKey: string | null,
  nextKey: string | null,
  forceRemoveTimeout: number,
  removePersist: (persist: Persist) => void
): Persist => {
  const ref = createAnimationEndHandlerRef(() => {
    removePersist(persist)
  }, forceRemoveTimeout)

  exitProps.ref = ref

  const persist = {
    node: cloneNodeWithExitProps(node, exitProps),
    ref: ref,
    key: node.key!,
    prevKey: prevKey,
    nextKey: nextKey,
  }

  return persist
}

const cloneNodeWithExitProps = (
  node: Node,
  exitProps: PersistProps
): Node => {
  // Рефы можно не мерджить, так как если элемент удалился из
  // родительского элемента, то ему в данный момент явно не передается
  // ни какой ref
  if (exitProps.className && node.props.className) {
    exitProps.className = mergeClassNames(
      node.props.className,
      exitProps.className
    )
  }

  return cloneElement(node, exitProps) as Node
}

const wrapNodeWithExitContext = (
  node: Node,
  exitContextValue: ExitContextValueT,
  ref: ExitAnimationDetectorRef | undefined
): Node => {
  return (
    <ExitContext.Provider key={node.key} value={[exitContextValue, ref]}>
      {node}
    </ExitContext.Provider>
  ) as Node
}

const createAnimationEndHandlerRef = (
  handler: () => void,
  forceRemoveTimeout: number
) => {
  const runnedProps = new Set()
  let anyPropsWasRunned = false
  let handlerCalled = false
  let prevElem: HTMLElement | null

  const forceStopAnimationTimeoutId = setTimeout(() => {
    if (!anyPropsWasRunned) {
      callHandler()
    }
  }, forceRemoveTimeout)

  const callHandler = () => {
    if (handlerCalled) return
    handlerCalled = true
    clearTimeout(forceStopAnimationTimeoutId)
    handler()
  }

  const onTransitionRun = (event: TransitionEvent) => {
    runnedProps.add(event.propertyName)
    anyPropsWasRunned = true
  }

  const onTransitionFinish = (event: TransitionEvent) => {
    if (runnedProps.has(event.propertyName)) {
      runnedProps.delete(event.propertyName)
      if (runnedProps.size === 0) {
        callHandler()
      }
    }
  }

  return (element: HTMLElement | null) => {
    if (prevElem) {
      prevElem.removeEventListener('transitionrun', onTransitionRun)
      prevElem.removeEventListener('transitionend', onTransitionFinish)
      prevElem.removeEventListener('transitioncancel', onTransitionFinish)
    }

    if (element) {
      element.addEventListener('transitionrun', onTransitionRun)
      element.addEventListener('transitionend', onTransitionFinish)
      element.addEventListener('transitioncancel', onTransitionFinish)
    }

    prevElem = element
  }
}

export const ExitContext = createContext<ExitContextTuple>([
  undefined,
  undefined,
])

export const useExitContext = <T extends any>(
  defaultValue: T = undefined as T
): ExitContextTuple<T> => {
  const [contextValue, ref] = useContext<ExitContextTuple<T>>(ExitContext)
  return [contextValue ?? defaultValue, ref]
}

const wrapEveryNodeWithExitContext = (
  children: Node[],
  persists: Persist[],
  exitContextValue: ExitContextValueT
) => {
  const persistByKey = new Map(
    persists.map((persist) => [persist.key, persist])
  )

  return children.map((node) => {
    if (persistByKey.has(node.key)) {
      const persist = persistByKey.get(node.key)!
      return wrapNodeWithExitContext(node, exitContextValue, persist.ref)
    }
    return wrapNodeWithExitContext(node, undefined, undefined)
  })
}

const mergeClassNames = (
  classNameA: string = '',
  classNameB: string = ''
): string => {
  const a = classNameA.split(/\s+/)
  const b = classNameB.split(/\s+/)
  return Array.from(new Set([...a, ...b])).join(' ')
}
