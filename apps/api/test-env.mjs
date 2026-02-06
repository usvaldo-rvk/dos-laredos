import { readFileSync } from 'fs'

const envContent = readFileSync('.env', 'utf8')
console.log('=== .env content ===')
console.log(envContent)
console.log('=== Character codes for first line ===')
const firstLine = envContent.split('\n')[0]
console.log(firstLine.split('').map(c => c.charCodeAt(0)).join(' '))
