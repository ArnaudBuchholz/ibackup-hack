'use strict'

require('colors')
const { readdir } = require('fs')
const { join } = require('path')
const { promisify } = require('util')
const { log, serve } = require('reserve')
// const gpf = require('gpf-js')

const readdirAsync = promisify(readdir)

async function main () {
  // Detect port
  const localStorage = join(process.env.LOCALAPPDATA, 'iBackup Viewer/cache/Local Storage')
  const files = await readdirAsync(localStorage)
  const port = parseInt(/http_127.0.0.1_(\d+)/.exec(files[0])[1])
  console.log('Port:'.gray, port.toString().green)

  const baseUrl = `http://127.0.0.1:${port}`

  // console.log(await gpf.http.get(`${baseUrl}/`))
  // console.log(await gpf.http.get(`${baseUrl}/pages/about.html`))

  // const response = await gpf.http.request({
  //   method: gpf.http.methods.get,
  //   url: `${baseUrl}/backup`,
  //   headers: {
  //     'Accept': '*/*',
  //     'Accept-Encoding': 'gzip, deflate',
  //     'Accept-Language': 'en-US,en;q=0.8',
  //     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.0 Safari/537.36',
  //     // 'X-Requested-With': 'XMLHttpRequest',
  //     // 'cookie': 'session-id=e3e0ec4a-7f31-4fef-ad69-d8ff2962aac9;',
  //     'Referer': `${baseUrl}/pages/loading.html`,
  //     'X-PRIVATE_APPKEY': '?!?',
  //     // 'X-PRIVATE_APPKEY': '9c4d8ad6-8dbd-11ea-b95a-989096a0cb48',
  //     'Connection': 'keep-alive',
  //     'Host': `127.0.0.1:${port}`
  //   }
  // })
  // console.log(response)

  log(serve({
    port: 8080,
    mappings: [{
      match: "^/$",
      file: join(__dirname, 'index.html')
    }, {
      match: "^/(.*)",
      url: `${baseUrl}/$1`,
      'forward-request': ({ request: { method, url, headers }}) => {
        console.log('before', headers)
        headers.referer = `${baseUrl}/pages/loading.html`,
        delete headers.cookie
        Object.keys(headers).forEach(name => name.startsWith('sec-') ? delete headers[name] : 0)
        console.log('after', headers)
      }
    }]
  }), true)
}

main()
