# Wire.js &nbsp; [![npm version](https://img.shields.io/npm/v/wire.svg?style=flat)](https://www.npmjs.com/package/wire) [![CircleCI](https://circleci.com/gh/callumlocke/wire.svg?style=shield)](https://circleci.com/gh/callumlocke/wire)

Wire is an experimental build toolkit aiming to make this possible:

```js
const outputFiles = await transform(sourceFiles);
```

It is not a CLI tool. It's a Node.js library that helps you:

- convert any third party build tool into an async function
- compose those functions together into a pipeline
- perform light, incremental rebuilds whenever source files change

> More details to follow
