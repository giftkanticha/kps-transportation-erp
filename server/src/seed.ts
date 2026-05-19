import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')
  const exists = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (exists) { console.log('Already seeded'); return }

  await prisma.user.create({
    data: { username: 'admin', email: 'admin@kps.com', displayName: 'KPS Administrator', passwordHash: await bcrypt.hash('admin1234', 10), status: 'ACTIVE', role: 'SUPER_ADMIN' },
  })
  await prisma.user.create({
    data: { username: 'manager1', email: 'manager@kps.com', displayName: 'ผู้จัดการฝ่าย', passwordHash: await bcrypt.hash('pass1234', 10), status: 'ACTIVE', role: 'MANAGER' },
  })
  await prisma.user.create({
    data: { username: 'emp01', email: 'emp@kps.com', displayName: 'พนักงานทดสอบ', passwordHash: await bcrypt.hash('pass1234', 10), status: 'PENDING_APPROVAL', role: 'EMPLOYEE' },
  })

  console.log('Seed complete:')
  console.log('  admin / admin1234  (SUPER_ADMIN)')
  console.log('  manager1 / pass1234  (MANAGER)')
  console.log('  emp01 / pass1234  (PENDING - needs approval)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
