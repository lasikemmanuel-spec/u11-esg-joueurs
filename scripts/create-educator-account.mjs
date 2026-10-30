import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
  throw new Error('Lancez cet outil dans un terminal interactif pour saisir le mot de passe sans l’afficher.')
}

const prompt = readline.createInterface({ input: stdin, output: stdout })
const username = (await prompt.question('Identifiant éducateur : ')).trim()
const displayName = (await prompt.question('Nom affiché : ')).trim()
const role = (await prompt.question('Rôle (educator/admin) : ')).trim()
prompt.close()

if (!username || !displayName || !['educator', 'admin'].includes(role)) {
  throw new Error('Identifiant, nom affiché ou rôle invalide.')
}

function readHidden(promptText) {
  stdout.write(promptText)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve, reject) => {
    let password = ''
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          reject(new Error('Saisie annulée.'))
          return
        }
        if (character === '\r' || character === '\n') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          stdout.write('\n')
          resolve(password)
          return
        }
        if (character === '\u007f' || character === '\b') {
          password = password.slice(0, -1)
          continue
        }
        password += character
      }
    }

    stdin.on('data', onData)
  })
}

let password = await readHidden('Mot de passe (12 à 256 caractères) : ')
if (password.length < 12 || password.length > 256) {
  throw new Error('Choisissez un mot de passe de 12 à 256 caractères.')
}

const salt = crypto.randomBytes(16)
const hash = crypto.scryptSync(password, salt, 64)
password = ''
const account = {
  username,
  displayName,
  role,
  passwordHash: `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`,
}

stdout.write(`${JSON.stringify(account)}\n`)
