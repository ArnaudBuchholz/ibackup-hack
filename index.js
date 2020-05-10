'use strict'

require('colors')
const { createWriteStream, mkdir, readdir } = require('fs')
const { dirname, join } = require('path')
const { promisify } = require('util')
const { log, serve } = require('reserve')

const readdirAsync = promisify(readdir)
const mkdirAsync = promisify(mkdir)

async function detectPort () {
  const localStorage = join(process.env.LOCALAPPDATA, 'iBackup Viewer/cache/Local Storage')
  const files = await readdirAsync(localStorage)
  const port = /http_127.0.0.1_(\d+)/.exec(files[0])[1]
  console.log('Port:'.gray, port.green)
  return port
}

async function main () {

  let iBackupPort

  const cacheBasePath = join(__dirname, 'cache')
  await mkdirAsync(cacheBasePath, { recursive : true })

  log(serve({
    port: 8080,
    mappings: [{
    //   method: 'GET',
    //   match: /^(\/.*(?:js|css|svg|jpg))/,
    //   file: `${cacheBasePath}$1`,
    //   'ignore-if-not-found': true
    // }, {
      method: 'GET',
      custom: async (request, response) => {
        if (/\.(js|css|svg|jpg)$/.exec(request.url)) {
          const cachePath = join(cacheBasePath, '.' + request.url)
          const cacheFolder = dirname(cachePath)
          await mkdirAsync(cacheFolder, { recursive : true })
          const out = createWriteStream(cachePath)
          const _writeHead = response.writeHead
          response.writeHead = function (status, headers) {
            console.log(arguments)
            _writeHead.apply(response, arguments)
          }
          const hook = method => {
            const nativeImpl = response[method]
            response[method] = (data, encoding, callback) => {
              out[method](data, encoding, () => {
                nativeImpl.call(response, data, encoding, callback)
              })
            }
          }
          hook('write')
          hook('end')
        }
      }
    }, {
      match: /^\/(.*)/,
      url: 'http://facetheforce.today/$1'
    }, {
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

}

main()
