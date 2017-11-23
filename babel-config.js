const presets = [
  [
    'env',
    {
      targets: {
        node: '8.0',
      },
    },
  ],
]

const plugins = [
  [
    'transform-object-rest-spread',
    {
      useBuiltIns: true,
    },
  ],
  'transform-class-properties',
]

if (process.env.PRESERVE_MODULE_SYNTAX) presets[0][1].modules = false

if (process.env.PRESERVE_FLOW_ANNOTATIONS) plugins.unshift('syntax-flow')
else presets.push('flow')

module.exports = { presets, plugins }

// console.log(`\nBabel config:\n${JSON.stringify(module.exports, null, 2)}\n`)
