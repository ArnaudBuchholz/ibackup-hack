'use strict'

require('colors')
const { readFile } = require('fs')
const { join } = require('path')
const { promisify } = require('util')

const readFileAsync = promisify(readFile)

async function main () {
  const bkid = process.argv[2]
  console.log('Checking backup'.yellow, bkid.green)
  let notesCount = 0

  const basePath = join(__dirname, 'cache/backups', bkid)
  console.log('Loading notes index...'.gray)
  const notes = JSON.parse((await readFileAsync(join(basePath, 'notes.json'))).toString())
  for await (const part of notes) {
    console.log('*'.gray, part.name)
    for await (const folder of part.folders) {
      let folderNotes
      if (folder.count) {
        try {
          folderNotes = JSON.parse((await readFileAsync(join(basePath, `notes/${folder.recid}.json`))).toString())
        } catch (e) {
          console.log(' *'.gray, folder.name, folder.count.toString().red, 'no index'.red)
          continue
        }
      }
      console.log(' *'.gray, folder.name, folder.count.toString().green)
      if (folder.count) {
        for await (const index of folderNotes) {
          let note
          try {
            note = JSON.parse((await readFileAsync(join(basePath, `notes/${index.recid}.json`))).toString())
          } catch (e) {
            console.log('  *'.gray, index.title, index.summary.gray, 'no content'.red)
            continue
          }
          console.log('  *'.gray, index.title, index.summary.gray)
          ++notesCount
        }
      }
    }
  }

  console.log('Notes found: '.yellow, notesCount.toString().green)
}

main ()