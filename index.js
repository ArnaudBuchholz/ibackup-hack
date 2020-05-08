'use strict'

require('colors')
const { readdir } = require('fs')
const { join } = require('path')
const { promisify } = require('util')
const { log, serve } = require('reserve')

const readdirAsync = promisify(readdir)

async function detectPort () {
  const localStorage = join(process.env.LOCALAPPDATA, 'iBackup Viewer/cache/Local Storage')
  const files = await readdirAsync(localStorage)
  const port = /http_127.0.0.1_(\d+)/.exec(files[0])[1]
  console.log('Port:'.gray, port.green)
  return port
}

let iBackupPort

log(serve({
  port: 8080,
  mappings: [{
    match: /http:\/\/127.0.0.1:(\d+)(\/.*)/,
    custom: async (request, response, port, path) => {
      if (!iBackupPort) {
        iBackupPort = await detectPort()
      }
      if (port === iBackupPort && path === '/app?_cmd=get-license') {
        response.writeHead(200)
        response.end('{"result":true}')
      }
    }
  }, {
    match: /^(http:\/\/.*)/,
    url: '$1'
  }]
}), false)
