/**
 * 渲染引擎运行时检测工具
 * 通过WebGL检测当前渲染引擎是GPU还是CPU（SwiftShader软件渲染）
 * 无需IPC，纯renderer端检测
 */

export type RenderEngine = 'gpu' | 'cpu'

/**
 * 检测当前渲染引擎类型
 * 创建WebGL上下文，通过WEBGL_debug_renderer_info扩展获取实际渲染器名称
 * 若渲染器为SwiftShader（Chromium内置的软件渲染器），则为CPU渲染
 * 若获取到真实GPU渲染器名称，则为GPU渲染
 * 若无法获取WebGL上下文，则为CPU渲染
 */
export function detectRenderEngine(): RenderEngine {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return 'cpu'

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return 'gpu'

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    if (typeof renderer === 'string' && renderer.includes('SwiftShader')) {
      return 'cpu'
    }

    return 'gpu'
  } catch {
    return 'cpu'
  }
}