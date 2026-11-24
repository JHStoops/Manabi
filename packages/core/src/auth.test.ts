import {
  acceptInviteRequestSchema,
  changePasswordRequestSchema,
  loginRequestSchema,
  newPasswordSchema,
  opaqueTokenSchema,
  updateMeRequestSchema,
} from './index';
import { describeSchema } from './testCases';

const TOKEN = 'q7Xb3mZp0kLr8sTv2wYc5nHd9fGj4aEu6iOx1yRz0Bw';

describeSchema(
  'newPasswordSchema',
  newPasswordSchema,
  [
    ['10 characters', 'abcdefghij'],
    ['256 characters', 'a'.repeat(256)],
  ],
  [
    ['9 characters', 'abcdefghi'],
    ['257 characters', 'a'.repeat(257)],
  ],
);

describeSchema(
  'opaqueTokenSchema',
  opaqueTokenSchema,
  [['43 base64url characters', TOKEN]],
  [
    ['too short', TOKEN.slice(1)],
    ['a 64-hex digest', 'a'.repeat(64)],
    ['padding', `${TOKEN.slice(1)}=`],
  ],
);

describeSchema(
  'loginRequestSchema',
  loginRequestSchema,
  [
    ['a username', { identifier: 'hana', password: 'x' }],
    ['an email and a client kind', { identifier: 'h@x.jp', password: 'x', clientKind: 'mobile' }],
  ],
  [
    ['an empty identifier', { identifier: ' ', password: 'x' }],
    ['an empty password', { identifier: 'hana', password: '' }],
    ['an unknown client kind', { identifier: 'hana', password: 'x', clientKind: 'desktop' }],
  ],
);

const invite = {
  token: TOKEN,
  username: 'hana',
  displayName: 'Hana',
  password: 'a long passphrase',
  dailyGoal: 20,
};

describeSchema(
  'acceptInviteRequestSchema',
  acceptInviteRequestSchema,
  [
    ['the required fields', invite],
    ['an email and time zone', { ...invite, email: 'h@x.jp', timeZone: 'Asia/Tokyo' }],
  ],
  [
    ['a short password', { ...invite, password: 'short' }],
    ['a username with @', { ...invite, username: 'h@x' }],
    ['an unknown daily goal', { ...invite, dailyGoal: 15 }],
    ['a bad time zone', { ...invite, timeZone: 'Mars/Base' }],
  ],
);

describeSchema(
  'changePasswordRequestSchema',
  changePasswordRequestSchema,
  [['both passwords', { currentPassword: 'x', newPassword: 'a long passphrase' }]],
  [['a short new password', { currentPassword: 'x', newPassword: 'short' }]],
);

it('defaults the client kind to web and the time zone to UTC', () => {
  expect(acceptInviteRequestSchema.parse(invite)).toMatchObject({
    clientKind: 'web',
    timeZone: 'UTC',
  });
});

describeSchema(
  'updateMeRequestSchema',
  updateMeRequestSchema,
  [
    ['an empty patch', {}],
    ['a display name', { displayName: 'Hana' }],
    ['settings only', { settings: { theme: 'umi', avatarInitial: 'は' } }],
  ],
  [
    ['a blank display name', { displayName: '  ' }],
    ['a time zone', { timeZone: 'Europe/Paris' }],
    ['a role', { role: 'admin' }],
    ['an email', { email: 'a@b.c' }],
    ['a bad setting', { settings: { dailyGoal: 15 } }],
  ],
);
