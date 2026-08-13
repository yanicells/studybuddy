import { parseCards } from '../core/import'
import type { Database } from './database.server'
import { createDeck, createFolder, importCards, listFolders } from './library.server'

const ARCHITECTURE_CARDS = `What is computer architecture?
- Attributes of a system that are **visible to a programmer**
- These attributes directly affect the **logical execution** of a program

What term is used interchangeably with computer architecture?
- **Instruction set architecture (ISA)**

What does the ISA define?
- **Instruction formats**, opcodes, registers, and memory
- Effect of executing instructions on registers and memory
- Algorithm for controlling instruction execution

Give examples of architectural attributes.
- The **instruction set**
- The number of bits used to represent various data types
- **I/O mechanisms**
- Techniques for addressing memory

What is an example of an architectural design issue?
- Whether or not a computer will have a **multiply instruction**

How should you think of computer architecture?
- Design specifications that a **user manual** will also refer to
- It lists the features, what they do, and what users need to know to use them

What is computer organization?
- The **operational units** and their **interconnections** that realize the architectural specifications

Architecture says what? Organization says what?
- Architecture says **what is supported**
- Organization says **how to support it**

Give examples of organizational attributes.
- Hardware details **transparent to the programmer**
- Interfaces between the computer and peripherals
- The **memory technology** used

What is an example of an organizational issue for multiply?
- How the multiply instruction, if present, will actually be **implemented**
- By a special multiply unit, or by repeatedly using the **add unit**

What may that multiply implementation decision be based on?
- How often the instruction will be used
- **Performance** comparisons
- **Cost/size** comparisons

How should you think of computer organization?
- A possible way to make the specific **computer architecture** described

Can computers share architecture but differ in organization?
- Yes. Identical **architecture** with differences in **organization** is possible

Why does identical architecture with different organization matter?
- No need to **rewrite software** for each and every machine
- Software is an **investment**

Why replace an older model that keeps the same architecture?
- Greater **speed**, lower **cost**, or both`

const STRUCTURE_CARDS = `How are modern computers arranged despite millions of components?
- Arranged in a **hierarchical system**
- Explored as interrelated subsystems down to the elementary subsystem

Why use a hierarchical structure?
- Makes it easy to describe and design
- Possible to focus on **one level** of the system at a time

What does behavior at each level depend on?
- A simplified, abstracted characterization of the system at the **next lower level**

What is structure?
- The way in which components are **interrelated**

What is function?
- The **operation** of each individual component as part of the structure

What are the four basic functions a computer can perform?
- **Data Processing**
- **Data Storage**
- **Data Movement**
- **Control**

What is true of data processing?
- Data may take a wide variety of forms
- The range of processing requirements is broad
- There are only a few **fundamental methods** or types of data processing

Why does a computer need short-term data storage?
- Even while processing data on the fly, it must **temporarily store** the pieces being worked on

Why does a computer need long-term data storage?
- Files of data have to be available for subsequent **retrieval and update**

What is input-output (I/O)?
- Data received from or delivered to a device **directly connected** to the computer

What is data communications?
- Data moved over **longer distances**, to or from a remote device

What does a control unit do?
- Manages the computer's **resources**
- Directs functional parts in response to **instructions**

What are the four main structural components of a traditional computer?
- **Central Processing Unit (CPU)**
- **Main Memory**
- **I/O**
- **System Interconnection**

What does the CPU do?
- **Controls** the operation of the computer
- Performs its **data processing** functions
- This is what the term **processor** used to refer to

Why must the definition of processor be adjusted later?
- Current computers have **multiple processing units**

What does main memory store?
- **Short-term** data

What does I/O do?
- Moves data between the computer and its **external environment**

What is system interconnection?
- Communication among the CPU, main memory, and I/O
- A common example is the **system bus**

What is a system bus?
- A number of **conducting wires** to which all other components are attached

What are the major structural components of the CPU?
- **Control Unit**
- **Arithmetic and Logic Unit**
- **Registers**
- **CPU Interconnection**

What does the control unit do?
- Directs the operation of the **CPU** and, by extension, the computer

What does the ALU do?
- Performs the computer's **data processing** functions

What do registers provide?
- Storage **internal to the CPU**
- This is NOT **main memory**

What is CPU interconnection?
- Communication among the control unit, **ALU**, and registers

When is the term multicore computer used?
- When multiple processing units all reside on a **single chip**

What is a core?
- Each processing unit on a multicore chip
- May be equivalent to a **CPU** on a single-CPU system
- Or optimized for **vector and matrix** operations

What is a processor, updated definition?
- The component that **interprets and executes instructions**
- A physical piece of silicon containing **one or more cores**

What is a multicore processor?
- A processor that contains **multiple cores**

What does the computer's operating environment consist of?
- Devices that are either **sources or destinations** of data
- This requires some form of **data movement**

What traditional computer is assumed for now?
- A single processing unit
- It employs a **microprogrammed control unit**

What can the designer focus on at each hierarchical level?
- **Structure** and **function**
- Behavior depends only on a simplified view of the next lower level`

export async function seedSampleIfMissing(db: Database): Promise<boolean> {
  if ((await listFolders(db)).some((folder) => folder.name === 'CSCI 50.01')) return false

  const course = await createFolder(db, null, 'CSCI 50.01')
  const lecture = await createFolder(db, course.id, 'Hardware Lecture')
  const architecture = await createDeck(db, lecture.id, 'Architecture vs Organization')
  const structure = await createDeck(db, lecture.id, 'Structure and Function')
  await importCards(db, architecture.id, parseCards(ARCHITECTURE_CARDS))
  await importCards(db, structure.id, parseCards(STRUCTURE_CARDS))
  return true
}
