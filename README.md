# Wire.js &nbsp; [![npm version](https://img.shields.io/npm/v/wire.svg?style=flat)](https://www.npmjs.com/package/wire) [![CircleCI](https://circleci.com/gh/callumlocke/wire.svg?style=shield)](https://circleci.com/gh/callumlocke/wire)

Wire is an experimental toolkit for building apps. It aims to make build feel more like this:

```js
const outputFiles = await transform(sourceFiles);
```

Wire is not a CLI tool. It is a Node.js library that enables you to:

- convert any third party build tool into an async function
- compose those functions together into a pipeline
- perform light, incremental rebuilds whenever source files change

> More details to follow
