'use strict'

require('colors')
const { readdir } = require('fs')
const { join } = require('path')
const { promisify } = require('util')
const gpf = require('gpf-js')

const readdirAsync = promisify(readdir)

async function main () {
  // Detect port
  const localStorage = join(process.env.LOCALAPPDATA, 'iBackup Viewer/cache/Local Storage')
  const files = await readdirAsync(localStorage)
  const port = parseInt(/http_127.0.0.1_(\d+)/.exec(files[0])[1])
  console.log('Port:'.gray, port.toString().green)

  const baseUrl = `http://127.0.0.1:${port}`

  console.log(await gpf.http.get(`${baseUrl}/`))
  console.log(await gpf.http.get(`${baseUrl}/pages/about.html`))

  const response = await gpf.http.get(`${baseUrl}/notes?bkid=3&_cmd=notes`)
  console.log(response)
}

main()
