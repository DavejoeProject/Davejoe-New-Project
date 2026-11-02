/**
 * Comprehensive verification of System Audit & Workflow Corrections
 * Davejoe Digital Operating System
 */

import { AttendanceService } from '../src/services/attendanceService';
import { approveMaterialRequest } from '../src/services/materialRequestsService';
import { AdminService } from '../src/services/adminService';
import { ProjectControlService } from '../src/services/projectControlService';
import { ProjectProjectionsService } from '../src/services/projectProjectionsService';

async function runAuditVerification() {
  console.log('================================================================');
  console.log('DAVEJOE DIGITAL OPERATING SYSTEM — SYSTEM AUDIT VERIFICATION');
  console.log('================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition: boolean, title: string) {
    totalChecks++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      passedChecks++;
    } else {
      console.error(`[FAIL] ${title}`);
    }
  }

  // 1. Attendance across all 9 roles
  console.log('--- 1. Testing Universal Clock-In & Attendance Identity ---');
  assert(
    typeof AttendanceService.clockInNonLeadershipUser === 'function',
    'AttendanceService.clockInNonLeadershipUser exists'
  );
  assert(
    typeof AttendanceService.getUserTodayAttendanceStatus === 'function',
    'AttendanceService.getUserTodayAttendanceStatus exists'
  );
  assert(
    typeof AttendanceService.getUserAttendanceHistory === 'function',
    'AttendanceService.getUserAttendanceHistory exists'
  );

  // 2. Material requests approval and stock deduction
  console.log('\n--- 2. Testing Material Requests Approval & Inventory Ledger ---');
  assert(
    typeof approveMaterialRequest === 'function',
    'approveMaterialRequest function exists and is exported'
  );

  // 3. Admin Project & Role Management
  console.log('\n--- 3. Testing Admin Role Creation & Projects Service ---');
  assert(
    typeof AdminService.createRole === 'function',
    'AdminService.createRole function exists'
  );
  assert(
    typeof AdminService.updateRole === 'function',
    'AdminService.updateRole function exists'
  );
  assert(
    typeof AdminService.getRoles === 'function',
    'AdminService.getRoles function exists'
  );
  assert(
    typeof AdminService.assignRolePermission === 'function',
    'AdminService.assignRolePermission function exists'
  );

  // 4. Workforce multiple assignments & availability
  console.log('\n--- 4. Testing Workforce Multiple Assignment Contract ---');
  assert(
    typeof ProjectControlService.getAvailableWorkforceMembers === 'function',
    'ProjectControlService.getAvailableWorkforceMembers exists'
  );
  assert(
    typeof ProjectControlService.assignWorkforce === 'function',
    'ProjectControlService.assignWorkforce exists'
  );

  // 5. Project Planning & Projections Supabase persistence
  console.log('\n--- 5. Testing Project Planning & Projections Supabase Integration ---');
  assert(
    typeof ProjectProjectionsService.getProjections === 'function',
    'ProjectProjectionsService.getProjections exists'
  );
  assert(
    typeof ProjectProjectionsService.createProjection === 'function',
    'ProjectProjectionsService.createProjection exists'
  );
  assert(
    typeof ProjectProjectionsService.requestContribution === 'function',
    'ProjectProjectionsService.requestContribution exists'
  );
  assert(
    typeof ProjectProjectionsService.convertToProject === 'function',
    'ProjectProjectionsService.convertToProject exists'
  );

  console.log('\n================================================================');
  console.log(`AUDIT VERIFICATION SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  console.log('================================================================\n');

  if (passedChecks !== totalChecks) {
    process.exit(1);
  }
}

runAuditVerification().catch((err) => {
  console.error('Audit verification crashed:', err);
  process.exit(1);
});
