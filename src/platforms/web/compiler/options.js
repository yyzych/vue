/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

/**
 * @ych
 * isPreTag: 检查标签是否是 'pre' 标签
 * isUnaryTag: 检测给定的标签是否是一元标签
 * canBeLeftOpenTag: 检测一个标签是否是那些虽然不是一元标签，但却可以自己补全并闭合的标签
 * isReservedTag: 检查给定的标签是否是保留的标签
 * getTagNamespace: 获取元素(标签)的命名空间
 */
export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}
