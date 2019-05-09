/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      /**
       * @ych
       * 因为 __proto__ 属性是在 IE11+ 才开始支持，对于不支持的直接在数组实例上定义变异方法
       * 否则的话就覆盖数组实例的__proto__，指向arrayMethods（arrayMethods.__proto__ = Array.prototype）
       */
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      /**
       * @ych
       * 递归的观测那些类型为数组或对象的数组元素
       */
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    /**
     * @ych
     * 使用Object.defineProperty使这些方法不可枚举
     */
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/**
 * @ych
 * asRootData: 代表将要被观测的数据是否是根级数据,根数据对象就是 data 对象
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    /**
     * @ych
     * Vue实例对象才有_isVue属性，避免Vue实例对象观测
     */
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  /**
   * @ych
   * 已经定义了getter和setter则缓存
   */
  const getter = property && property.get
  const setter = property && property.set
  /**
   * @ych
   * !getter
   * 属性拥有自己的 getter 时就不会对其深度观测。val=undefined
   * getter函数用户自定义，出于避免引发不可预见行为的考虑？
   *
   * setter
   * 当数据对象的某一个属性只拥有 get 拦截器函数而没有 set 拦截器函数时，此时该属性不会被深度观测。
   * 但是经过 defineReactive 函数的处理之后，
   * 该属性将被重新定义 getter 和 setter。此时该属性变成了既拥有 get 函数又拥有 set 函数。
   * 并且当我们尝试给该属性重新赋值时，那么新的值将会被观测。（set里面有一句childOb = !shallow && observe(newVal)）
   * 这时候矛盾就产生了：原本该属性不会被深度观测，但是重新赋值之后，新的值却被观测了。（定义响应式数据时行为的不一致）
   * 
   * arguments.length === 2
   * 没有明确传val进来
   */
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        /**
         * @ych
         * dep.depend()： 收集依赖到该属性的dep中
         * childOb.dep.depend()： 将同样的依赖也收集一份到childOb.dep中。注意：dep是通过闭包引用的，childOb.dep是通过Observer对象引用的
         * 对该属性的修改（通过setter）能出发依赖，
         * 但是如果值是一个对象，给对象增加/删除一个属性是不能触发依赖的。
         * 必须通过Vue.set API才能触发依赖，依赖记录在childOb.dep中
         * Vue.set = function (obj, key, val) {
         *   defineReactive(obj, key, val)
         *   obj.__ob__.dep.notify()
         * }
         */
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          /**
           * @ych
           * 对于数组来讲，其索引并不是“访问器属性”, 
           * 所以当有观察者依赖数组的某一个元素时是触发不了这个元素的 get 函数的，当然也就收集不到依赖
           * 所以需要拦截变异方法
           *
           * 数组中的每一个元素也要收集依赖（如元素为对象，给对象增加/删除/修改，也意味着该数组改变了，也要触发依赖）
           */
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      /**
       * @ych
       * 假如我们为属性设置的新值是一个数组或者纯对象，那么该数组或纯对象是未被观测的，
       * 所以需要对新值进行观测，这就是第一句代码的作用，同时使用新的观测对象重写 childOb 的值
       */
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  /**
   * @ych
   * https://github.com/vuejs/vue/issues/6845
   */
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  /**
   * @ych
   * target 必须是响应式数据。
   * 根数据对象不是响应的，所以为根数据对象添加属性时，是不会触发依赖，是不被允许的
   * （响应式属性必须要求一个**属性**有get和set，但是data是Vue实例的属性，initData时传如了data，对它下面的所有属性设置了响应，
   * 但是没有针对data自身设置getter和setter，这需要在Vue实例层面调用Object.defineProperty(vue实例，data, 属性描述符)
   * 不是响应式意味着不会在getter时收集依赖，不会在setter时触发依赖）
   * 根数据对象ob.vmCount>0
   */
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
