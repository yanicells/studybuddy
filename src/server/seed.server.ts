import type Database from 'better-sqlite3'

import { parseCards } from '../core/import'
import { createDeck, createFolder, importCards, listFolders } from './library.server'

const ARCHITECTURE_CARDS = `What is computer architecture?
- Attributes of a system that are ==visible to a programmer==
- These attributes affect the ==logical execution== of a program

What does the ISA define?
- ==Instruction formats==, opcodes, registers, and memory
- The effect of instructions on registers and memory

Give examples of architectural attributes.
- The ==instruction set==
- ==I/O mechanisms==
- Techniques for addressing memory

What is computer organization?
- The ==operational units== and their ==interconnections== that realize architectural specifications

Architecture says what? Organization says what?
- Architecture says ==what is supported==
- Organization says ==how to support it==

Why can machines share architecture but differ in organization?
- Software does not need to be ==rewritten== for each machine
- Software is an ==investment==`

const STRUCTURE_CARDS = `Why use a hierarchical structure?
- It makes a computer easier to describe and design
- You can focus on ==one level== at a time

What is structure?
- The way components are ==interrelated==

What is function?
- The ==operation== of each component as part of the structure

What are the four basic functions of a computer?
- ==Data Processing==
- ==Data Storage==
- ==Data Movement==
- ==Control==

What are the four main structural components of a traditional computer?
- ==Central Processing Unit (CPU)==
- ==Main Memory==
- ==I/O==
- ==System Interconnection==

What does the control unit do?
- Manages the computer's ==resources==
- Directs functional parts in response to ==instructions==

What does the ALU do?
- Performs the computer's ==data processing== functions

What do registers provide?
- Storage ==internal to the CPU==
- This is not ==main memory==`

export function seedSampleIfMissing(db: Database.Database): boolean {
  if (listFolders(db).some((folder) => folder.name === 'CSCI 50.01')) return false

  const course = createFolder(db, null, 'CSCI 50.01')
  const lecture = createFolder(db, course.id, 'Hardware Lecture')
  const architecture = createDeck(db, lecture.id, 'Architecture vs Organization')
  const structure = createDeck(db, lecture.id, 'Structure and Function')
  importCards(db, architecture.id, parseCards(ARCHITECTURE_CARDS))
  importCards(db, structure.id, parseCards(STRUCTURE_CARDS))
  return true
}
