'use strict'

require('colors')
const { readFile, stat } = require('fs')
const { join } = require('path')
const { promisify } = require('util')

const readFileAsync = promisify(readFile)
const statAsync = promisify(stat)

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
  const bkid = process.argv[2]
  console.log('Checking backup'.yellow, bkid.green)
  let notesCount = 0
  let notesInError = {}

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
          let notePath = join(basePath, `notes/${index.recid}.json`)
          try {
            const note = JSON.parse((await readFileAsync(notePath)).toString())
            for await (const item of note.content) {
              if (item.type === 'image') {
                if (!await fileExists(join(basePath, 'backup', item.path))) {
                  throw new Error(`missing image ${item.path}`)
                }
              }
            }
          } catch (e) {
            console.log('  *'.gray, index.title, index.summary.gray, e.toString().red)
            notesInError[notePath] = e
            continue
          }
          console.log('  *'.gray, index.title, index.summary.gray)
          ++notesCount
        }
      }
    }
  }

  console.log('Notes found: '.yellow, notesCount.toString().green)
  const errorCount = Object.keys(notesInError).length
  if (errorCount) {
    console.error('Invalid notes : '.red, errorCount.toString().red)
    Object.keys(notesInError).forEach(notePath => {
      console.log(notePath.gray, '\n\t', notesInError[notePath].toString().red)
    })
  }
}

main ()