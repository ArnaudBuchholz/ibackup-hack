'use strict'

require('colors')
const { createWriteStream, mkdir, readdir, readFile, writeFile, stat } = require('fs')
const { dirname, join } = require('path')
const { promisify } = require('util')
const { capture, log, serve } = require('reserve')

const mkdirAsync = promisify(mkdir)
const readdirAsync = promisify(readdir)
const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)
const statAsync = promisify(stat)

async function detectPort () {
  const localStorage = join(process.env.LOCALAPPDATA, 'iBackup Viewer/cache/Local Storage')
  const files = await readdirAsync(localStorage)
  const port = /http_127.0.0.1_(\d+)/.exec(files[0])[1]
  console.log('Port:'.gray, port.green)
  return port
}

function clean (path) {
  if (/\?_=\d+$/.exec(path)) {
    path = path.split('?_=')[0]
  }
  return path
}

async function fileExists (path) {
  try {
    const fileStat = await statAsync(path)
    if (fileStat && fileStat.isFile()) {
      return true
    }
  } catch (e) {
    // ignore
  }
  return false
}

async function main () {

  let iBackupPort

  const cacheBasePath = join(__dirname, 'cache')
  await mkdirAsync(cacheBasePath, { recursive : true })

  log(serve({
    port: 8080,
    mappings: [{
      method: 'GET',
      match: /^local:(.*)/,
      file: `${cacheBasePath}$1`
    }, {
      match: /http:\/\/127.0.0.1:(\d+)(\/.*)/,
      custom: async (request, response, port, path) => {
        if (!iBackupPort) {
          iBackupPort = await detectPort()
        }
        if (port !== iBackupPort) {
          return
        }
        if (path === '/app?_cmd=get-license') {
          response.writeHead(200)
          response.end('{"result":true}')
          return
        }
        if (request.method === 'GET' && /(\w+)\?bkid=\d+/.exec(path)) {
          const match = /(\w+)\?bkid=(\d+)(?:&_cmd=(\w+)&(?:id=(\d+)|domain=AppDomainGroup-group.com.apple.notes&path=(.*)))?(?:&password=)?$/.exec(path)
          if (match) {
            const data = match[1]
            const bkid = match[2]
            const cmd = match[3]
            const id = match[4]
            const mediaPath = match[5]
            const path = ['./backups/', bkid, '/', data]
            if (cmd) {
              if (id) {
                path.push('/', id, '.json')
              } else {
                path.push('/', unescape(mediaPath))
              }
            } else {
              path.push('.json')
            }
            const cachePath = join(cacheBasePath, path.join(''))
            if (await fileExists(cachePath)) {
              return // Prevents overwrite
            }
            const cacheFolder = dirname(cachePath)
            await mkdirAsync(cacheFolder, { recursive : true })
            const cached = createWriteStream(cachePath)
            capture(response, cached)
              .then(async () => {
                if (cachePath.endsWith('.json')) {
                  const buffer = await readFileAsync(cachePath)
                  const json = JSON.parse(buffer.toString())
                  await writeFileAsync(cachePath, JSON.stringify(json, undefined, 2))
                }
              })
            return
          }
        }
        if (request.method === 'GET' && /\.(js|css|svg|jpe?g)(?:\?_=\d+)?$/.exec(request.url)) {
          const cleanedPath = clean(path)
          const cachePath = join(cacheBasePath, '.' + cleanedPath)
          if (await fileExists(cachePath)) {
            return `local:${cleanedPath}`
          }
          const cacheFolder = dirname(cachePath)
          await mkdirAsync(cacheFolder, { recursive : true })
          const cached = createWriteStream(cachePath)
          capture(response, cached)
          return
        }
      }
    }, {
      match: /^(http:\/\/.*)/,
      url: '$1'
    }]
  }), process.argv.includes('--verbose'))
}

main()
