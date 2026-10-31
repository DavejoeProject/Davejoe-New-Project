import { ProjectProjectionsService } from '../src/services/projectProjectionsService';

async function runTests() {
  console.log('=== DAVEJOE PROJECT PLANNING & PROJECTIONS MODULE VERIFICATION ===\n');

  // Test 1: Financial calculation logic
  console.log('1. Testing Cost & Profitability Calculations:');
  const fin = ProjectProjectionsService.calculateFinancials({
    materialCost: 2000000,
    labourCost: 1000000,
    equipmentCost: 200000,
    logisticsCost: 300000,
    contingencyPct: 10,
    sellingPrice: 5000000,
  });

  const expectedDirect = 3500000;
  const expectedContingency = 350000;
  const expectedTotalCost = 3850000;
  const expectedProfit = 1150000;
  const expectedMargin = 23; // 1150000 / 5000000 = 23%

  const finPassed =
    fin.contingencyAmount === expectedContingency &&
    fin.estimatedGrandTotal === expectedTotalCost &&
    fin.proposedSellingPrice === 5000000 &&
    fin.projectedGrossProfit === expectedProfit &&
    fin.projectedGrossMarginPct === expectedMargin;

  console.log(`  - Direct Cost: ₦${expectedDirect.toLocaleString()}`);
  console.log(`  - Contingency (10%): ₦${fin.contingencyAmount.toLocaleString()} (Expected: ₦${expectedContingency.toLocaleString()})`);
  console.log(`  - Total Cost: ₦${fin.estimatedGrandTotal.toLocaleString()} (Expected: ₦${expectedTotalCost.toLocaleString()})`);
  console.log(`  - Proposed Contract Price: ₦${fin.proposedSellingPrice.toLocaleString()}`);
  console.log(`  - Projected Gross Profit: ₦${fin.projectedGrossProfit.toLocaleString()} (Expected: ₦${expectedProfit.toLocaleString()})`);
  console.log(`  - Gross Margin %: ${fin.projectedGrossMarginPct}% (Expected: ${expectedMargin}%)`);
  console.log(`  Result: ${finPassed ? 'PASS' : 'FAIL'}\n`);

  if (!finPassed) {
    console.error('Financial calculation verification failed.');
    process.exit(1);
  }

  // Test 2: Sequence Number Generation
  console.log('2. Testing Projection Sequence Code Format:');
  const code = ProjectProjectionsService.generateProjectionNumber();
  const codeRegex = /^PRJ-PROJ-\d{4}-\d{3}$/;
  const codePassed = codeRegex.test(code);
  console.log(`  - Generated Code: "${code}" -> ${codePassed ? 'PASS' : 'FAIL'}\n`);

  if (!codePassed) {
    console.error('Projection sequence code format invalid.');
    process.exit(1);
  }

  // Test 3: Create Projection in Service
  console.log('3. Testing Projection Creation & BOQ aggregation:');
  const createRes = await ProjectProjectionsService.createProjection({
    title: 'Test Lekki Phase 1 Penthouse',
    proposed_project_name: 'Test Lekki Phase 1 Penthouse',
    client_name: 'Test Estate Holdings Ltd',
    client_phone: '+2348012345678',
    client_email: 'test@estateholdings.ng',
    site_location: 'Admiralty Way, Lekki Phase 1',
    scope_of_work: 'Complete bespoke parquet flooring and Italian marble skirting',
    target_duration_weeks: 3,
    contingency_percentage: 5,
    proposed_selling_price: 3500000,
    line_items: [
      {
        category: 'materials',
        item_description: 'Engineered Oak Planks',
        unit_of_measure: 'sqm',
        quantity: 50,
        unit_cost: 35000,
        total_cost: 1750000,
        sort_order: 1,
      },
      {
        category: 'labour',
        item_description: 'Master Floor Installer',
        unit_of_measure: 'days',
        quantity: 10,
        unit_cost: 30000,
        total_cost: 300000,
        sort_order: 2,
      },
    ],
  });

  const created = createRes.data;
  const createdPassed = Boolean(
    created &&
    created.projection_number &&
    created.total_material_cost === 1750000 &&
    created.total_labour_cost === 300000 &&
    created.status === 'draft'
  );
  console.log(`  - Projection Number: ${created?.projection_number}`);
  console.log(`  - Status: ${created?.status}`);
  console.log(`  - Material Total: ₦${created?.total_material_cost.toLocaleString()}`);
  console.log(`  - Labour Total: ₦${created?.total_labour_cost.toLocaleString()}`);
  console.log(`  - Estimated Grand Total: ₦${created?.estimated_grand_total.toLocaleString()}`);
  console.log(`  - Result: ${createdPassed ? 'PASS' : 'FAIL'}\n`);

  if (!createdPassed || !created) {
    console.error('Projection creation failed.');
    process.exit(1);
  }

  // Test 4: Departmental Contribution Request
  console.log('4. Testing Departmental Contribution Workflow:');
  const contribRes = await ProjectProjectionsService.requestContribution({
    projectionId: created.id,
    invitedRole: 'technical',
    instructions: 'Please inspect the sub-screed moisture content and confirm sqm.',
  });
  console.log(`  - Request Technical Contribution: ${contribRes.success ? 'PASS' : 'FAIL'}`);

  const fetched = await ProjectProjectionsService.getProjectionById(created.id);
  const contrib = fetched.data?.contributions?.[0];
  const contribPassed = Boolean(contrib && contrib.invited_role === 'technical' && contrib.status === 'pending');
  console.log(`  - Contribution Status: ${contrib?.status} (Expected: pending) -> ${contribPassed ? 'PASS' : 'FAIL'}\n`);

  if (!contribPassed || !contrib) {
    console.error('Contribution request verification failed.');
    process.exit(1);
  }

  // Test 5: Submit Contribution Findings
  console.log('5. Testing Departmental Findings Submission:');
  const submitContribRes = await ProjectProjectionsService.submitContribution({
    projectionId: created.id,
    contributionId: contrib.id,
    findings: 'Screed moisture verified at 2.4% (acceptable). Suggest adding 1 extra roll of membrane.',
  });
  console.log(`  - Submit Findings: ${submitContribRes.success ? 'PASS' : 'FAIL'}`);

  const fetchedAfterSubmit = await ProjectProjectionsService.getProjectionById(created.id);
  const updatedContrib = fetchedAfterSubmit.data?.contributions?.[0];
  const submitPassed = Boolean(updatedContrib && updatedContrib.status === 'submitted' && updatedContrib.findings);
  console.log(`  - Status after submission: ${updatedContrib?.status} (Expected: submitted) -> ${submitPassed ? 'PASS' : 'FAIL'}\n`);

  if (!submitPassed) {
    console.error('Contribution submission failed.');
    process.exit(1);
  }

  // Test 6: Management Approval
  console.log('6. Testing Management Review & Decision:');
  const approveRes = await ProjectProjectionsService.reviewProjection({
    projectionId: created.id,
    decision: 'approved',
    comments: 'Commercial margins meet standard Davejoe criteria. Approved for quotation issuance.',
  });
  console.log(`  - Approval Decision: ${approveRes.success ? 'PASS' : 'FAIL'}`);

  const fetchedApproved = await ProjectProjectionsService.getProjectionById(created.id);
  const isNowApproved = fetchedApproved.data?.status === 'approved';
  console.log(`  - Status: ${fetchedApproved.data?.status} (Expected: approved) -> ${isNowApproved ? 'PASS' : 'FAIL'}\n`);

  if (!isNowApproved) {
    console.error('Approval failed.');
    process.exit(1);
  }

  // Test 7: Direct Edit Protection on Approved Records
  console.log('7. Testing Edit Protection on Approved Projections:');
  const tamperRes = await ProjectProjectionsService.updateProjection(created.id, {
    proposed_project_name: 'Tampered Name',
  });
  const protectedPassed = Boolean(tamperRes.error && tamperRes.error.includes('cannot be modified directly'));
  console.log(`  - Direct Edit Rejection: "${tamperRes.error}" -> ${protectedPassed ? 'PASS' : 'FAIL'}\n`);

  if (!protectedPassed) {
    console.error('Approved projection tamper protection failed.');
    process.exit(1);
  }

  // Test 8: Quotation Client Acceptance
  console.log('8. Testing Client Quotation Acceptance:');
  const quoteRes = await ProjectProjectionsService.updateQuotation(created.id, {
    client_response: 'accepted',
    acceptance_date: new Date().toISOString(),
  });
  console.log(`  - Client Acceptance recorded: ${quoteRes.success ? 'PASS' : 'FAIL'}`);

  const fetchedAccepted = await ProjectProjectionsService.getProjectionById(created.id);
  const isReady = fetchedAccepted.data?.sub_status === 'ready_for_conversion';
  console.log(`  - Sub-status: ${fetchedAccepted.data?.sub_status} (Expected: ready_for_conversion) -> ${isReady ? 'PASS' : 'FAIL'}\n`);

  if (!isReady) {
    console.error('Client acceptance status check failed.');
    process.exit(1);
  }

  // Test 9: Project Conversion
  console.log('9. Testing Idempotent Conversion to Official Project:');
  const convertRes = await ProjectProjectionsService.convertToProject(created.id);
  const convertPassed = Boolean(convertRes.data && convertRes.data.project_code);
  console.log(`  - Converted Project Code: ${convertRes.data?.project_code}`);
  console.log(`  - Conversion Status: ${convertPassed ? 'PASS' : 'FAIL'}`);

  // Test 10: Duplicate Conversion Prevention
  const duplicateConvertRes = await ProjectProjectionsService.convertToProject(created.id);
  const duplicateProtected =
    duplicateConvertRes.data?.project_code === convertRes.data?.project_code;
  console.log(`  - Duplicate Conversion Guard: Same Code Retained (${duplicateConvertRes.data?.project_code}) -> ${duplicateProtected ? 'PASS' : 'FAIL'}\n`);

  if (!duplicateProtected) {
    console.error('Duplicate conversion protection failed.');
    process.exit(1);
  }

  console.log('=== ALL 10 PROJECT PLANNING & PROJECTIONS TESTS PASSED SUCCESSFULLY ===');
}

runTests();
