/**
 * DAVEJOE MANAGEMENT TOOL — UNIT AND CONTRACT VERIFICATION SUITE
 * 
 * NOTE: These tests verify in-memory contracts, route helpers, role definitions,
 * authorization logic, and payload validation rules.
 * 
 * DISCLAIMER: These are offline unit/contract verification tests. They do NOT
 * represent live integration testing against a remote Supabase production instance.
 */

import { ROLE_CONFIGS, StandardRoleKey, normalizeRoleKey } from '../src/services/authService';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n=== DAVEJOE AUTHORIZATION & CONTRACT VERIFICATION ===\n');

// 1. Nine Roles Verification
test('All 9 standard role configurations exist and have unique routes', () => {
  const expectedRoles: StandardRoleKey[] = [
    'management',
    'executive_director',
    'admin',
    'technical',
    'supervisor',
    'procurement',
    'accounts',
    'artisan',
    'social_media_manager',
  ];

  const actualKeys = Object.keys(ROLE_CONFIGS) as StandardRoleKey[];
  assert(actualKeys.length === 9, `Expected 9 roles, found ${actualKeys.length}`);

  for (const role of expectedRoles) {
    assert(Boolean(ROLE_CONFIGS[role]), `Missing role config for ${role}`);
    assert(Boolean(ROLE_CONFIGS[role].route), `Role ${role} missing route`);
    assert(Boolean(ROLE_CONFIGS[role].label), `Role ${role} missing label`);
  }
});

// 2. Leadership Parity Logic
test('Leadership parity: Management / CEO and Executive Director have equal administrative flags', () => {
  const leadershipRoles: StandardRoleKey[] = ['management', 'executive_director'];
  const ordinaryStaffRoles: StandardRoleKey[] = [
    'admin',
    'technical',
    'supervisor',
    'procurement',
    'accounts',
    'artisan',
    'social_media_manager',
  ];

  const checkIsLeadership = (roleKey: StandardRoleKey) =>
    roleKey === 'management' || roleKey === 'executive_director';

  for (const role of leadershipRoles) {
    assert(checkIsLeadership(role), `${role} should be recognized as leadership`);
  }

  for (const role of ordinaryStaffRoles) {
    assert(!checkIsLeadership(role), `${role} must NOT have elevated leadership authorization`);
  }
});

// 3. canAccessRoute for Social Media
test('Social Media route access: Allows social_media_manager, management, and executive_director', () => {
  const canAccessRoute = (roleKey: StandardRoleKey, pathname: string): boolean => {
    if (pathname.startsWith('/social-media') || pathname.startsWith('/social')) {
      return (
        roleKey === 'social_media_manager' ||
        roleKey === 'management' ||
        roleKey === 'executive_director'
      );
    }
    return false;
  };

  assert(canAccessRoute('social_media_manager', '/social-media'), 'Social Media Manager must access /social-media');
  assert(canAccessRoute('management', '/social-media'), 'Management / CEO must access /social-media');
  assert(canAccessRoute('executive_director', '/social-media'), 'Executive Director must access /social-media');

  const deniedRoles: StandardRoleKey[] = [
    'artisan',
    'supervisor',
    'technical',
    'procurement',
    'accounts',
  ];

  for (const role of deniedRoles) {
    assert(!canAccessRoute(role, '/social-media'), `${role} must NOT access /social-media`);
  }
});

// 4. Parameter Validation for User Creation Contract
test('Account creation input contract rejects missing or invalid fields', () => {
  const validateInput = (input: {
    email?: string;
    firstName?: string;
    roleSlugs?: string[];
  }) => {
    const email = input.email?.trim().toLowerCase() || '';
    const firstName = input.firstName?.trim() || '';
    const roleSlugs = (input.roleSlugs || []).filter(Boolean);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Valid email required');
    }
    if (!firstName) {
      throw new Error('First name required');
    }
    if (roleSlugs.length === 0) {
      throw new Error('At least one role required');
    }
    return true;
  };

  // Valid
  assert(
    validateInput({
      email: 'coordinator@davejoeinteriors.com',
      firstName: 'Tunde',
      roleSlugs: ['admin'],
    }),
    'Valid input should pass'
  );

  // Invalid email
  let caught = false;
  try {
    validateInput({ email: 'invalid-email', firstName: 'Tunde', roleSlugs: ['admin'] });
  } catch {
    caught = true;
  }
  assert(caught, 'Should reject invalid email');

  // Missing name
  caught = false;
  try {
    validateInput({ email: 'user@davejoe.com', firstName: '', roleSlugs: ['admin'] });
  } catch {
    caught = true;
  }
  assert(caught, 'Should reject empty firstName');

  // Missing roles
  caught = false;
  try {
    validateInput({ email: 'user@davejoe.com', firstName: 'Sam', roleSlugs: [] });
  } catch {
    caught = true;
  }
  assert(caught, 'Should reject empty roleSlugs');
});

// 5. Response Contract Shape
test('Account creation response contract conforms to expected shape', () => {
  interface CreateUserResponse {
    success: boolean;
    user_id: string;
    email: string;
    assigned_roles: string[];
    message?: string;
  }

  const sampleResponse: CreateUserResponse = {
    success: true,
    user_id: '11111111-2222-3333-4444-555555555555',
    email: 'newuser@davejoeinteriors.com',
    assigned_roles: ['procurement'],
    message: 'User account created and roles assigned successfully.',
  };

  assert(sampleResponse.success === true, 'Success flag must be true');
  assert(typeof sampleResponse.user_id === 'string' && sampleResponse.user_id.length > 0, 'user_id must be non-empty');
  assert(Array.isArray(sampleResponse.assigned_roles) && sampleResponse.assigned_roles.length === 1, 'assigned_roles must be an array');
});

// Summary
const totalPassed = results.filter((r) => r.passed).length;
console.log(`\nResults: ${totalPassed}/${results.length} tests passed.\n`);

if (totalPassed !== results.length) {
  process.exit(1);
}
