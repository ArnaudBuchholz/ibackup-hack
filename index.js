'use strict'

require('colors')
const { createWriteStream, mkdir, readdir } = require('fs')
const { dirname, join } = require('path')
const { promisify } = require('util')
const { log, serve } = require('reserve')
const zlib = require('zlib')
const { pipeline } = require('stream')

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
          const { end, write, writeHead } = response
          let count = 0
          response.writeHead = function (status, headers) {

            console.log(request.url, 'writeHead')
            if (status === 200) {
              const file = createWriteStream(cachePath)
              let out
            //   // if (false && headers['content-encoding'] === 'gzip') {
            //   //   out = zlib.createGunzip()
            //   // } else {
                out = file
            //   // }
              let waitForDrain = false
              response.write = (data, encoding, callback) => {
                const myCount = ++count
                console.log(request.url, 'write >> ', myCount, data.length, !!callback)
                out.write(data, encoding, () => {
                  const ready = write.call(response, data, encoding, function () {
                    console.log(request.url, 'write << ', myCount, data.length)
                    if (callback) {
                      callback.apply(this, arguments)
                    }
                  })
                  if (ready) {
                    setTimeout(() => {
                      waitForDrain = false
                      response.emit('drain')
                    }, 0)
                  }
                })
                waitForDrain = true
                return false
              }
              response.end = (data, encoding, callback) => {
                const myCount = ++count
                console.log(request.url, 'end', myCount, (data || []).length, !!callback)
                if (waitForDrain) {
                  response.on('drain', () => {
                    end.apply(response, arguments)
                  })
                } else {
                  end.apply(response, arguments)
                }
            //     // if (!data) {
            //     //   if (out !== file) {
            //     //     pipeline(out, file, () => {
            //     //       end.apply(response, arguments)
            //     //     })
            //     //   } else {
            //     //     end.apply(response, arguments)
            //     //   }
            //     // }
            //     out.end(data, encoding, () => {
            //       // if (out !== file) {
            //       //   pipeline(out, file, () => {
            //       //     end.apply(response, arguments)
            //       //   })
            //       // } else {
            //         end.apply(response, arguments)
            //       // }
            //     })
              }
            }
            writeHead.apply(response, arguments)
          }
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
