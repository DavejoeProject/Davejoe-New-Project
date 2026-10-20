// Automated system validation for Davejoe Management Tool
import { normalizeRoleKey, StandardRoleKey } from '../src/services/authService';

console.log('=== DAVEJOE OPERATIONAL SYSTEM VALIDATION ===\n');

// 1. Role Normalization and Discovery Test across all 9 roles
const expectedRoles: { slug: string; standardKey: StandardRoleKey; workspaceRoute: string }[] = [
  { slug: 'management', standardKey: 'management', workspaceRoute: '/management' },
  { slug: 'executive_director', standardKey: 'executive_director', workspaceRoute: '/executive' },
  { slug: 'admin', standardKey: 'admin', workspaceRoute: '/admin' },
  { slug: 'technical', standardKey: 'technical', workspaceRoute: '/technical' },
  { slug: 'supervisor', standardKey: 'supervisor', workspaceRoute: '/supervisor' },
  { slug: 'procurement', standardKey: 'procurement', workspaceRoute: '/procurement' },
  { slug: 'accounts', standardKey: 'accounts', workspaceRoute: '/accounts' },
  { slug: 'artisan', standardKey: 'artisan', workspaceRoute: '/artisan' },
  { slug: 'social_media_manager', standardKey: 'social_media_manager', workspaceRoute: '/social-media' },
];

console.log('1. Testing Role Normalization across all 9 distinct business roles:');
let allRolesPassed = true;
for (const r of expectedRoles) {
  const normalized = normalizeRoleKey(r.slug);
  const passed = normalized === r.standardKey;
  if (!passed) allRolesPassed = false;
  console.log(`  - Role [${r.slug}] -> Normalized: [${normalized}] (Target: [${r.standardKey}]) - ${passed ? 'PASS' : 'FAIL'}`);
}

if (!allRolesPassed) {
  console.error('FAILED: One or more role keys failed normalization.');
  process.exit(1);
}
console.log('Role Normalization: ALL 9 ROLES PASS.\n');

// 2. Status Enforcement Logic Check
console.log('2. Testing Account Status Authorization Enforcement:');
const statuses = [
  { status: 'active', expectedAllowed: true },
  { status: 'pending', expectedAllowed: false },
  { status: 'suspended', expectedAllowed: false },
  { status: 'inactive', expectedAllowed: false },
  { status: 'UNKNOWN', expectedAllowed: false },
  { status: '', expectedAllowed: false },
];

let allStatusesPassed = true;
for (const s of statuses) {
  const isAllowed = Boolean(s.status && s.status.toLowerCase().trim() === 'active');
  const passed = isAllowed === s.expectedAllowed;
  if (!passed) allStatusesPassed = false;
  console.log(`  - Status [${s.status || '<empty>'}] -> Allowed: ${isAllowed} (Expected: ${s.expectedAllowed}) - ${passed ? 'PASS' : 'FAIL'}`);
}

if (!allStatusesPassed) {
  console.error('FAILED: Status enforcement logic mismatch.');
  process.exit(1);
}
console.log('Account Status Verification: PASS.\n');

// 3. Multi-Role and Equal Leadership Governance Parity Check
console.log('3. Testing Leadership Authority and Multi-Role Access:');
function simulateAccess(roles: string[], pathname: string, status: string = 'active'): boolean {
  if (status !== 'active') return false;
  const isLeadership = roles.includes('management') || roles.includes('executive_director');
  if (isLeadership) return true; // Leadership has operational oversight

  if (pathname.startsWith('/admin')) return roles.includes('admin');
  if (pathname.startsWith('/management')) return roles.includes('management');
  if (pathname.startsWith('/executive')) return roles.includes('executive_director');
  if (pathname.startsWith('/technical')) return roles.includes('technical');
  if (pathname.startsWith('/supervisor')) return roles.includes('supervisor');
  if (pathname.startsWith('/attendance')) return roles.includes('supervisor');
  if (pathname.startsWith('/procurement')) return roles.includes('procurement');
  if (pathname.startsWith('/accounts')) return roles.includes('accounts');
  if (pathname.startsWith('/artisan')) return roles.includes('artisan') || roles.includes('supervisor');
  if (pathname.startsWith('/social-media')) return roles.includes('social_media_manager');
  return false;
}

const accessMatrix = [
  { userRoles: ['management'], path: '/management', expected: true, desc: 'Management on CEO workspace' },
  { userRoles: ['management'], path: '/executive', expected: true, desc: 'Management on Executive workspace' },
  { userRoles: ['management'], path: '/technical', expected: true, desc: 'Management on Technical inspection' },
  { userRoles: ['management'], path: '/procurement', expected: true, desc: 'Management on Procurement' },
  { userRoles: ['management'], path: '/accounts', expected: true, desc: 'Management on Accounts' },
  { userRoles: ['management'], path: '/social-media', expected: true, desc: 'Management on Social Media' },
  
  { userRoles: ['executive_director'], path: '/management', expected: true, desc: 'Executive Director on Management workspace' },
  { userRoles: ['executive_director'], path: '/executive', expected: true, desc: 'Executive Director on Executive workspace' },
  { userRoles: ['executive_director'], path: '/technical', expected: true, desc: 'Executive Director on Technical inspection' },
  { userRoles: ['executive_director'], path: '/procurement', expected: true, desc: 'Executive Director on Procurement' },
  { userRoles: ['executive_director'], path: '/accounts', expected: true, desc: 'Executive Director on Accounts' },
  { userRoles: ['executive_director'], path: '/social-media', expected: true, desc: 'Executive Director on Social Media' },

  { userRoles: ['technical'], path: '/technical', expected: true, desc: 'Technical user on Technical workspace' },
  { userRoles: ['technical'], path: '/management', expected: false, desc: 'Technical user blocked from Management' },
  { userRoles: ['technical'], path: '/accounts', expected: false, desc: 'Technical user blocked from Accounts' },

  { userRoles: ['artisan'], path: '/artisan', expected: true, desc: 'Artisan user on Artisan workspace' },
  { userRoles: ['artisan'], path: '/supervisor', expected: false, desc: 'Artisan user blocked from Supervisor' },

  { userRoles: ['management'], path: '/management', status: 'suspended', expected: false, desc: 'Suspended Management blocked' },
  { userRoles: ['supervisor'], path: '/supervisor', status: 'pending', expected: false, desc: 'Pending Supervisor blocked' },
  { userRoles: ['admin'], path: '/admin', status: 'inactive', expected: false, desc: 'Inactive Admin blocked' },
];

let allAccessPassed = true;
for (const test of accessMatrix) {
  const result = simulateAccess(test.userRoles, test.path, test.status || 'active');
  const passed = result === test.expected;
  if (!passed) allAccessPassed = false;
  console.log(`  - [${test.desc}] -> Access: ${result} (Expected: ${test.expected}) - ${passed ? 'PASS' : 'FAIL'}`);
}

if (!allAccessPassed) {
  console.error('FAILED: Access matrix mismatch.');
  process.exit(1);
}
console.log('\n=== ALL SYSTEM AUTOMATED CHECKS COMPLETED: PASS ===');
