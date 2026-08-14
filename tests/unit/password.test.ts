import { hashPassword, comparePassword } from '../../server/auth/password';

export async function testPasswordHashing() {
  console.log('\n--- Running Password Hashing & Authentication Tests ---');

  const rawPassword = 'SuperSecretAdminPassword2026!';
  const hash = await hashPassword(rawPassword);

  if (!hash || hash === rawPassword || !hash.startsWith('$2')) {
    throw new Error('Password hash failed or did not produce standard bcrypt string');
  }

  const matches = await comparePassword(rawPassword, hash);
  if (!matches) {
    throw new Error('Bcrypt comparison failed on matching raw password');
  }

  const wrongMatches = await comparePassword('IncorrectPassword123!', hash);
  if (wrongMatches) {
    throw new Error('Bcrypt comparison matched incorrect password');
  }

  console.log('  ✓ [Test 7] Bcrypt password hashing & secure salt verification succeeded.');
}
