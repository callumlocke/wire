// flow-typed signature: 54d29eae5a54ed92b26988ccb4adeb16
// flow-typed version: 4a76611614/filesize-parser_v1.x.x/flow_>=v0.25.x

declare module "filesize-parser" {
  declare module.exports: (
    input: string,
    options?: { base?: number }
  ) => number;
}
