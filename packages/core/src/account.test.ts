import {
  defaultLearnerSettings,
  emailSchema,
  roleSchema,
  timeZoneSchema,
  usernameSchema,
  userSchema,
} from './index';
import { describeSchema } from './testCases';

describeSchema(
  'roleSchema',
  roleSchema,
  [
    ['admin', 'admin'],
    ['learner', 'learner'],
  ],
  [
    ['author', 'author'],
    ['Admin', 'Admin'],
  ],
);

describeSchema(
  'usernameSchema',
  usernameSchema,
  [
    ['a name', 'hanako'],
    ['64 characters', 'a'.repeat(64)],
  ],
  [
    ['an @', 'hanako@home'],
    ['a space', 'hana ko'],
    ['empty', ''],
    ['65 characters', 'a'.repeat(65)],
  ],
);

describeSchema(
  'emailSchema',
  emailSchema,
  [['an address', 'hanako@example.com']],
  [
    ['no @', 'hanako.example.com'],
    ['a space', 'hana ko@example.com'],
    ['too long', `${'a'.repeat(250)}@b.cd`],
  ],
);

describeSchema(
  'timeZoneSchema',
  timeZoneSchema,
  [
    ['Asia/Tokyo', 'Asia/Tokyo'],
    ['UTC', 'UTC'],
  ],
  [
    ['empty', ''],
    ['an unknown zone', 'Mars/Olympus_Mons'],
  ],
);

const user = {
  id: 1,
  username: 'hanako',
  email: null,
  displayName: 'Hanako',
  role: 'learner',
  mustChangePassword: false,
  timeZone: 'Asia/Tokyo',
  settings: defaultLearnerSettings,
  disabledAt: null,
};

describeSchema(
  'userSchema',
  userSchema,
  [
    ['a learner without email', user],
    ['an admin with email', { ...user, role: 'admin', email: 'hanako@example.com' }],
  ],
  [
    ['a third role', { ...user, role: 'author' }],
    ['an empty display name', { ...user, displayName: '' }],
    ['a bad time zone', { ...user, timeZone: 'Tokyo' }],
  ],
);
