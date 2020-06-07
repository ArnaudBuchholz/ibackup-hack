'use strict'

require('colors')
const { copyFile, mkdir, readFile, stat, writeFile } = require('fs')
const { extname, join } = require('path')
const { promisify } = require('util')

const copyFileAsync = promisify(copyFile)
const mkdirAsync = promisify(mkdir)
const readFileAsync = promisify(readFile)
const statAsync = promisify(stat)
const writeFileAsync = promisify(writeFile)

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
  if (bkid === undefined) {
    console.error('Specify backup id'.red);
    return
  }

  const partId = process.argv[3]

  console.log('Checking backup'.yellow, bkid.green)
  let notesCount = 0
  let notesInError = {}
  let notesSaved = 0

  const basePath = join(__dirname, 'cache/backups', bkid)
  const outBasePath = join(basePath, 'output')
  await mkdirAsync(outBasePath, {recursive: true})
  console.log('Loading notes index...'.gray)
  const notes = JSON.parse((await readFileAsync(join(basePath, 'notes.json'))).toString())
  for await (const part of notes) {
    console.log('*'.gray, part.recid.toString().padStart(5, ' ').yellow, part.name)
    const save = part.recid.toString() === partId
    for await (const folder of part.folders) {
      let folderNotes
      if (folder.count) {
        try {
          folderNotes = JSON.parse((await readFileAsync(join(basePath, `notes/${folder.recid}.json`))).toString())
        } catch (e) {
          console.log(' *'.gray, folder.recid.toString().padStart(5, ' ').yellow, folder.name, folder.count.toString().red, 'no index'.red)
          continue
        }
      }
      console.log(' *'.gray, folder.recid.toString().padStart(5, ' ').yellow, folder.name, folder.count.toString().green)
      if (save && folder.count) {
        for await (const index of folderNotes) {
          let notePath = join(basePath, `notes/${index.recid}.json`)
          const infos = {}
          if (index.title.startsWith('👍🏼')) {
            infos.title = index.title.replace('👍🏼', '')
            infos.rating = 5
          } else {
            infos.title = index.title
          }
          try {
            const note = JSON.parse((await readFileAsync(notePath)).toString())
            const markdown = []
            let numbered = 0
            let imageIndex = 0
            for await (const item of note.content) {
              if (item.type === 'image') {
                const imageSource = join(basePath, 'backup', item.path)
                if (!await fileExists(imageSource)) {
                  throw new Error(`missing image ${item.path}`)
                }
                ++imageIndex
                const imageName = `${index.recid}_${imageIndex}${extname(item.path)}`
                if (save) {
                  await copyFileAsync(imageSource, join(outBasePath, imageName))
                }
                if (!infos.preview) {
                  infos.preview = imageName
                }
                markdown.push(`![${index.recid}](${imageName})\n\n`)
              } else if (item.type === 'attributed') {
                let prefix = ''
                let suffix = ''
                if (item.style === 'title') {
                  markdown.push('# ')
                } else if (item.style === 'heading') {
                  markdown.push('## ')
                } else if (item.style === 'bullet') {
                  markdown.push('* ')
                } else if (item.style === 'numbered') {
                  ++numbered
                  markdown.push('${numbered}. ')
                } else if (item.style === 'checkbox' || item.style === 'dashed') {
                  prefix = '- '
                  suffix = '\n'
                } else if (item.style !== 'none') {
                  throw new Error(`unexpected attributed style ${item.style}`)
                }
                (item.elements || []).forEach(element => {
                  markdown.push(prefix, element.text, suffix)
                })
                markdown.push('\n\n')
              } else if (item.type === 'url') {
                markdown.push(`[${item.title || 'Lien internet'}](${item.url})\n\n`)
              } else if (item.type === 'video') {
                // ignored
              } else if (item.type !== 'generic') {
                throw new Error(`unknown item type ${item.type}`)
              }
            }
            const finalMarkdown = markdown.join('')
            const serving = /(\d+) portions/i.exec(finalMarkdown) || /portions : (\d+)/i.exec(finalMarkdown)
            if (serving) {
              infos.serving = parseInt(serving[1], 10)
            }
            const duration = /Préparation : (\d+) ?min(?:utes)?/.exec(finalMarkdown)
            if (duration) {
              infos.duration = parseInt(duration[1], 10)
            }
            if (save) {
              await writeFileAsync(join(outBasePath, `${index.recid}.md`), finalMarkdown)
              await writeFileAsync(join(outBasePath, `${index.recid}.json`), JSON.stringify(infos))
              ++notesSaved
            }
          } catch (e) {
            console.log('  *'.gray, index.recid.toString().padStart(5, ' ').yellow, index.title, e.toString().red)
            notesInError[notePath] = e
            continue
          }
          console.log('  *'.gray, index.recid.toString().padStart(5, ' ').yellow, index.title)
          // console.log(infos)
          ++notesCount
        }
      }
    }
  }

  console.log('Notes found: '.yellow, notesCount.toString().green)
  if (notesSaved) {
    console.log('Notes saved: '.yellow, notesSaved.toString().green)
  }
  const errorCount = Object.keys(notesInError).length
  if (errorCount) {
    console.error('Invalid notes : '.red, errorCount.toString().red)
    Object.keys(notesInError).forEach(notePath => {
      console.log(notePath.gray, '\n\t', notesInError[notePath].toString().red)
    })
  }
}

main ()