import type { Prisma } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRef, actorRef } from '../../db.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { generateUniquePasscode } from '../../lib/passcode.js';
import { istDayRange } from '../../lib/time.js';
import { notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { AttendanceQuery, CreateStaffBody, ListStaffQuery, UpdateStaffBody } from './staff.schemas.js';

const staffInclude = {
  flats: { include: { flat: flatInclude }, orderBy: { createdAt: 'asc' } },
  attendance: { where: { checkOutAt: null }, select: { id: true }, take: 1 },
} satisfies Prisma.StaffInclude;

const staffDTO = (s: Prisma.StaffGetPayload<{ include: typeof staffInclude }>, m: Member) => ({
  id: s.id, name: s.name, phone: s.phone, category: s.category,
  passcode: m.role === 'ADMIN' ? s.passcode : null,
  photoUrl: s.photoUrl, isActive: s.isActive, flats: s.flats.map(f => flatRef(f.flat)),
  isInside: s.attendance.length > 0, createdAt: s.createdAt,
});

const attendanceInclude = {
  staff: { select: { id: true, name: true, category: true } }, loggedBy: actorInclude,
} satisfies Prisma.StaffAttendanceInclude;

const attendanceDTO = (a: Prisma.StaffAttendanceGetPayload<{ include: typeof attendanceInclude }>) => ({
  id: a.id, staff: a.staff, checkInAt: a.checkInAt, checkOutAt: a.checkOutAt, loggedBy: actorRef(a.loggedBy),
});

async function findStaff(m: Member, id: string) {
  const s = await prisma.staff.findFirst({ where: { id, societyId: m.societyId }, include: staffInclude });
  if (!s) throw notFound('Staff');
  return s;
}

async function assertFlats(m: Member, flatIds: string[]) {
  const n = await prisma.flat.count({ where: { id: { in: flatIds }, societyId: m.societyId } });
  if (n !== new Set(flatIds).size) throw notFound('Flat');
}

export async function listStaff(m: Member, q: ListStaffQuery) {
  const isActive = q.isActive ?? (m.role === 'ADMIN' ? undefined : true);
  const rows = await prisma.staff.findMany({
    where: {
      societyId: m.societyId, isActive, category: q.category,
      ...(q.flatId && { flats: { some: { flatId: q.flatId } } }),
    },
    include: staffInclude, orderBy: { name: 'asc' },
  });
  return rows.map(s => staffDTO(s, m));
}

export async function createStaff(m: Member, input: CreateStaffBody) {
  const flatIds = [...new Set(input.flatIds ?? [])];
  await assertFlats(m, flatIds);
  const s = await prisma.$transaction(async tx => tx.staff.create({
    data: {
      societyId: m.societyId, name: input.name, phone: input.phone, category: input.category, photoUrl: input.photoUrl,
      passcode: await generateUniquePasscode(tx, m.societyId), flats: { create: flatIds.map(flatId => ({ flatId })) },
    },
    include: staffInclude,
  }));
  return staffDTO(s, m);
}

export async function updateStaff(m: Member, id: string, input: UpdateStaffBody) {
  await findStaff(m, id);
  return staffDTO(await prisma.staff.update({ where: { id }, data: input, include: staffInclude }), m);
}

export async function linkFlat(m: Member, id: string, flatId: string) {
  if (m.role === 'RESIDENT' && flatId !== m.flatId) throw forbidden('You can only link staff to your own flat');
  await findStaff(m, id);
  await assertFlats(m, [flatId]);
  await prisma.staffFlat.upsert({ where: { staffId_flatId: { staffId: id, flatId } }, update: {}, create: { staffId: id, flatId } });
  return staffDTO(await findStaff(m, id), m);
}

export async function listAttendance(m: Member, id: string, q: AttendanceQuery) {
  await findStaff(m, id);
  const range = q.date ? istDayRange(q.date) : null;
  const rows = await prisma.staffAttendance.findMany({
    where: { staffId: id, societyId: m.societyId, ...(range && { checkInAt: { gte: range.start, lt: range.end } }) },
    include: attendanceInclude, orderBy: { checkInAt: 'desc' }, take: q.limit,
  });
  return rows.map(attendanceDTO);
}

export async function toggleAttendanceByPasscode(m: Member, passcode: string) {
  const staff = await prisma.staff.findFirst({ where: { societyId: m.societyId, passcode, isActive: true } });
  if (!staff) return null;
  const now = new Date();
  const open = await prisma.staffAttendance.findFirst({ where: { staffId: staff.id, checkOutAt: null }, orderBy: { checkInAt: 'desc' } });
  const action = open ? 'CHECK_OUT' as const : 'CHECK_IN' as const;
  const row = open
    ? await prisma.staffAttendance.update({ where: { id: open.id }, data: { checkOutAt: now }, include: attendanceInclude })
    : await prisma.staffAttendance.create({
      data: { staffId: staff.id, societyId: m.societyId, checkInAt: now, loggedById: m.id }, include: attendanceInclude,
    });
  const full = await findStaff(m, staff.id);
  const flatIds = full.flats.map(f => f.flatId);
  if (flatIds.length) {
    notify({ societyId: m.societyId, flatIds }, {
      type: action === 'CHECK_IN' ? 'STAFF_ENTRY' : 'STAFF_EXIT',
      title: action === 'CHECK_IN' ? `${staff.name} arrived` : `${staff.name} left`,
      body: `${staff.name} (${staff.category.toLowerCase()}) ${action === 'CHECK_IN' ? 'entered' : 'left'} the society.`,
      data: { staffId: staff.id, attendanceId: row.id },
    });
  }
  return { action, staff: staffDTO(full, m), attendance: attendanceDTO(row) };
}
