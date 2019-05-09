/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

/**
 * @ych
 * codegen/: 根据AST生成目标平台代码
 * parser/: 解析原始代码并生成AST。有了 AST 之后我们就可以根据这个 AST 生成不同平台的目标代码
 */


// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  /**
   * @ych
   * 调用 parse 函数将字符串模板解析成抽象语法树(AST)
   * 调用 optimize 函数优化 ast
   * 调用 generate 函数将 ast 编译成渲染函数，字符串的形式
   */
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
