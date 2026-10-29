// Idempotent demo seed (brief §9, 08 §6). Safe to run repeatedly: reference rows are upserted on their
// unique keys and sample content is only created when that kind of content does not exist yet.
import { PrismaClient, type Prisma, type Role, type ResidentType } from '@prisma/client';

const prisma = new PrismaClient();
const IST_MS = 330 * 60_000;
const now = new Date();
const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const istDate = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const period = istDate(now).slice(0, 7);

async function main() {
  // Society (no natural unique key: look up by name)
  const society = (await prisma.society.findFirst({ where: { name: 'Emerald Heights' } }))
    ?? await prisma.society.create({
      data: { name: 'Emerald Heights', addressLine: '12 Outer Ring Road, Bellandur', city: 'Bengaluru', state: 'Karnataka', pincode: '560103' },
    });
  const societyId = society.id;

  // Blocks + flats
  const flats: Record<string, string> = {};
  for (const [blockName, numbers] of [['A', ['101', '102', '103', '104']], ['B', ['201', '202', '203', '204']]] as const) {
    const block = await prisma.block.upsert({
      where: { societyId_name: { societyId, name: blockName } }, update: {}, create: { societyId, name: blockName },
    });
    for (const number of numbers) {
      const f = await prisma.flat.upsert({
        where: { blockId_number: { blockId: block.id, number } }, update: {},
        create: { societyId, blockId: block.id, number, floor: Number(number[0]) },
      });
      flats[`${blockName}-${number}`] = f.id;
    }
  }

  // Users + memberships
  const people: { phone: string; name: string; role: Role; flat?: string; residentType?: ResidentType }[] = [
    { phone: '9000000001', name: 'Ananya Rao', role: 'ADMIN' },
    { phone: '9000000002', name: 'Rohan Mehta', role: 'RESIDENT', flat: 'A-101', residentType: 'OWNER' },
    { phone: '9000000003', name: 'Suresh Kumar', role: 'GUARD' },
    { phone: '9000000004', name: 'Priya Iyer', role: 'RESIDENT', flat: 'B-201', residentType: 'TENANT' },
  ];
  const mem: Record<string, string> = {};
  for (const p of people) {
    const user = await prisma.user.upsert({ where: { phone: p.phone }, update: {}, create: { phone: p.phone, name: p.name } });
    const data = { role: p.role, status: 'ACTIVE' as const, flatId: p.flat ? flats[p.flat] : null, residentType: p.residentType ?? null };
    const m = await prisma.membership.upsert({
      where: { userId_societyId: { userId: user.id, societyId } }, update: data, create: { userId: user.id, societyId, ...data },
    });
    mem[p.phone] = m.id;
  }
  const admin = mem['9000000001'], rohan = mem['9000000002'], guard = mem['9000000003'], priya = mem['9000000004'];

  // Staff (passcode is unique per society -> upsert key)
  const maid = await prisma.staff.upsert({
    where: { societyId_passcode: { societyId, passcode: '482913' } },
    update: { isActive: true },
    create: { societyId, name: 'Lakshmi Devi', category: 'MAID', passcode: '482913' },
  });
  await prisma.staffFlat.upsert({
    where: { staffId_flatId: { staffId: maid.id, flatId: flats['A-101'] } }, update: {}, create: { staffId: maid.id, flatId: flats['A-101'] },
  });
  await prisma.staff.upsert({
    where: { societyId_passcode: { societyId, passcode: '715264' } }, update: {},
    create: { societyId, name: 'Ramesh Gowda', category: 'DRIVER', passcode: '715264', flats: { create: [{ flatId: flats['B-201'] }] } },
  });

  // Demo pre-approval 135790: (re)armed on every run so the gate demo can be repeated.
  const paData = {
    status: 'ACTIVE' as const, validFrom: minsAgo(60), validTo: new Date(now.getTime() + 30 * 86_400_000), maxUses: 10, usedCount: 0,
  };
  const pa = await prisma.preApproval.findFirst({ where: { societyId, passcode: '135790' } });
  if (pa) await prisma.preApproval.update({ where: { id: pa.id }, data: paData });
  else await prisma.preApproval.create({
    data: { societyId, flatId: flats['A-101'], createdById: rohan, type: 'GUEST', guestName: 'Kavya Shah', guestPhone: '9811122233', passcode: '135790', ...paData },
  });

  // Amenities
  const amenities = [
    { name: 'Clubhouse', description: 'Party hall, seats 60', openTime: '09:00', closeTime: '22:00', slotMinutes: 60, capacity: 1, pricePerSlot: 50000 },
    { name: 'Tennis Court', description: 'Synthetic hard court with floodlights', openTime: '06:00', closeTime: '22:00', slotMinutes: 60, capacity: 1, pricePerSlot: 0 },
    { name: 'Swimming Pool', description: 'Temperature-controlled lap pool', openTime: '06:00', closeTime: '20:00', slotMinutes: 60, capacity: 10, pricePerSlot: 0 },
  ];
  for (const a of amenities) {
    if (!(await prisma.amenity.findFirst({ where: { societyId, name: a.name } }))) await prisma.amenity.create({ data: { ...a, societyId } });
  }

  // Current-month invoices for every flat; a few paid.
  const paid = new Set(['A-102', 'A-103', 'B-202', 'B-203', 'B-204']);
  for (const [label, flatId] of Object.entries(flats)) {
    const existing = await prisma.invoice.findUnique({ where: { flatId_period: { flatId, period } } });
    if (existing) continue;
    const inv = await prisma.invoice.create({
      data: { societyId, flatId, period, amount: 350000, dueDate: new Date(istDate(new Date(now.getTime() + 7 * 86_400_000))), status: paid.has(label) ? 'PAID' : 'UNPAID' },
    });
    if (paid.has(label)) {
      await prisma.payment.create({
        data: { invoiceId: inv.id, societyId, amount: inv.amount, method: 'UPI', reference: `MOCK-UPI-SEED${label.replace('-', '')}`, paidById: admin, paidAt: minsAgo(60 * 24) },
      });
    }
  }

  if (!(await prisma.expense.count({ where: { societyId } }))) {
    await prisma.expense.createMany({
      data: [
        { societyId, category: 'SECURITY', amount: 4500000, vendor: 'Shield Guarding Services', note: 'Monthly guard contract', spentOn: new Date(`${period}-01`), createdById: admin },
        { societyId, category: 'ELECTRICITY', amount: 1820000, vendor: 'BESCOM', note: 'Common area power', spentOn: new Date(istDate(daysAgo(1))), createdById: admin },
        { societyId, category: 'HOUSEKEEPING', amount: 960000, vendor: 'CleanCo', spentOn: new Date(istDate(now)), createdById: admin },
      ],
    });
  }

  if (!(await prisma.notice.count({ where: { societyId } }))) {
    await prisma.notice.create({ data: { societyId, title: 'Water supply shutdown', body: 'Water supply will be off on Sunday 10am-2pm for tank cleaning.', category: 'MAINTENANCE', isPinned: true, createdById: admin, createdAt: daysAgo(2) } });
    await prisma.notice.create({ data: { societyId, title: 'Diwali celebration', body: 'Join us at the clubhouse on Saturday at 7pm for lights, sweets and music.', category: 'EVENT', createdById: admin, createdAt: daysAgo(1) } });
    await prisma.notice.create({ data: { societyId, title: 'Visitor parking rules', body: 'Visitor vehicles must park in the marked bays near Gate 2.', category: 'GENERAL', createdById: admin } });
  }

  if (!(await prisma.poll.count({ where: { societyId } }))) {
    const poll = await prisma.poll.create({
      data: { societyId, question: 'Should we install EV chargers in the basement?', closesAt: new Date(now.getTime() + 14 * 86_400_000), createdById: admin },
    });
    const yes = await prisma.pollOption.create({ data: { pollId: poll.id, text: 'Yes' } });
    await prisma.pollOption.create({ data: { pollId: poll.id, text: 'No' } });
    await prisma.pollOption.create({ data: { pollId: poll.id, text: 'Need more information' } });
    await prisma.pollVote.create({ data: { pollId: poll.id, optionId: yes.id, membershipId: priya } });
  }

  if (!(await prisma.ticket.count({ where: { societyId } }))) {
    const t1 = await prisma.ticket.create({
      data: { societyId, flatId: flats['A-101'], raisedById: rohan, assignedToId: admin, category: 'PLUMBING', title: 'Kitchen sink leaking', description: 'Water leaking under the sink since morning.', priority: 'HIGH', status: 'IN_PROGRESS', createdAt: minsAgo(300) },
    });
    await prisma.ticketComment.create({ data: { ticketId: t1.id, societyId, authorId: admin, body: 'Plumber scheduled for 4pm.', createdAt: minsAgo(240) } });
    await prisma.ticketComment.create({ data: { ticketId: t1.id, societyId, authorId: rohan, body: 'Thanks, someone will be home.', createdAt: minsAgo(230) } });
    await prisma.ticket.create({
      data: { societyId, flatId: flats['B-201'], raisedById: priya, category: 'LIFT', title: 'Lift B makes a grinding noise', description: 'Noticed between floors 1 and 2.', priority: 'MEDIUM', status: 'OPEN', createdAt: minsAgo(90) },
    });
  }

  if (!(await prisma.visitor.count({ where: { societyId } }))) {
    const v = (flat: string, x: Omit<Prisma.VisitorCreateManyInput, 'societyId' | 'flatId' | 'loggedById'>) => ({ societyId, flatId: flats[flat], loggedById: guard, ...x });
    await prisma.visitor.createMany({
      data: [
        v('A-101', { type: 'GUEST', name: 'Meera Nair', status: 'CHECKED_OUT', decidedById: rohan, decidedAt: daysAgo(1), checkInAt: daysAgo(1), checkOutAt: minsAgo(60 * 22), createdAt: daysAgo(1) }),
        v('A-101', { type: 'DELIVERY', name: 'Arjun', company: 'QuickKart', status: 'COLLECTED', decidedById: rohan, decidedAt: minsAgo(60 * 5), checkOutAt: minsAgo(60 * 4), createdAt: minsAgo(60 * 5) }),
        v('A-101', { type: 'SERVICE', name: 'Imran (AC repair)', company: 'CoolAir', status: 'DENIED', decidedById: rohan, decidedAt: minsAgo(60 * 3), createdAt: minsAgo(60 * 3) }),
        v('B-201', { type: 'CAB', name: 'Vikram', company: 'Ola', vehicleNo: 'KA05MN4321', status: 'EXPIRED', createdAt: minsAgo(60 * 2) }),
        v('B-201', { type: 'GUEST', name: 'Sanjay Iyer', status: 'CHECKED_IN', decidedById: priya, decidedAt: minsAgo(40), checkInAt: minsAgo(38), createdAt: minsAgo(41) }),
      ],
    });
  }

  console.log(`Seeded Emerald Heights (${societyId}) — period ${period}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
