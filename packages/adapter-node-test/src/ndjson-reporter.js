#!/usr/bin/env node

export default async function* reporter(source) {
  for await (const event of source) {
    yield `${JSON.stringify(event)}\n`;
  }
}
