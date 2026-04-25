process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verify_core_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'verify_core_refresh_secret';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const User = require('../models/User');
const Item = require('../models/Item');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const Application = require('../models/Application');
const AuditLog = require('../models/AuditLog');
const RegistrationVerification = require('../models/RegistrationVerification');
const emailService = require('../services/emailService');
const { seedVipLevels } = require('../services/vipService');
const authController = require('../controllers/authController');
const assetController = require('../controllers/assetController');
const applicationController = require('../controllers/applicationController');
const adminApplicationController = require('../controllers/admin/applicationController');
const adminVipController = require('../controllers/admin/vipController');

let replSet;

function objectId(value) {
  return String(value._id || value);
}

function makeReq({ user, body = {}, params = {}, query = {} }) {
  return {
    user: { id: objectId(user) },
    body,
    params,
    query,
    headers: { 'user-agent': 'core-verification' },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function callController(handler, options) {
  const res = makeRes();
  await handler(makeReq(options), res);
  return { status: res.statusCode, body: res.body };
}

function expectStatus(result, status, label) {
  assert.equal(
    result.status,
    status,
    `${label}: expected HTTP ${status}, got HTTP ${result.status} ${JSON.stringify(result.body)}`
  );
}

async function resetDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Item.deleteMany({}),
    Ownership.deleteMany({}),
    Transaction.deleteMany({}),
    Application.deleteMany({}),
    AuditLog.deleteMany({}),
    RegistrationVerification.deleteMany({})
  ]);
  await seedVipLevels();
}

async function createUser(fields = {}) {
  return User.create({
    username: fields.username || `user_${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    password_hash: fields.password_hash || 'HASHED',
    roles: fields.roles || ['user'],
    ...fields
  });
}

async function testVerifiedEmailRegistration() {
  await resetDatabase();

  let capturedEmail = null;
  let capturedCode = null;
  let approvedEmail = null;
  let rejectedEmail = null;
  let rejectedReason = null;
  const originalSendRegistrationCodeEmail = emailService.sendRegistrationCodeEmail;
  const originalSendRegistrationApprovedEmail = emailService.sendRegistrationApprovedEmail;
  const originalSendRegistrationRejectedEmail = emailService.sendRegistrationRejectedEmail;
  emailService.sendRegistrationCodeEmail = async (email, code) => {
    capturedEmail = email;
    capturedCode = code;
  };
  emailService.sendRegistrationApprovedEmail = async (email) => {
    approvedEmail = email;
  };
  emailService.sendRegistrationRejectedEmail = async (email, user, reason) => {
    rejectedEmail = email;
    rejectedReason = reason;
  };

  try {
    const nonQqResult = await callController(authController.sendRegisterCode, {
      user: {},
      body: { email: 'NewUser@Example.Invalid', username: 'verified_user' }
    });
    expectStatus(nonQqResult, 400, 'reject non-QQ registration email');

    const sendCodeResult = await callController(authController.sendRegisterCode, {
      user: {},
      body: { email: '123456@qq.com', username: 'verified_user' }
    });
    expectStatus(sendCodeResult, 200, 'send registration code');
    assert.equal(capturedEmail, '123456@qq.com', 'registration email should be normalized');
    assert.match(capturedCode, /^\d{6}$/, 'registration code should be six digits');

    const pending = await RegistrationVerification.findOne({ email: '123456@qq.com' }).select('+code_hash').lean();
    assert.ok(pending, 'registration code should be stored before account creation');
    assert.equal(await User.countDocuments({ email: '123456@qq.com' }), 0, 'sending a code should not create a user');

    const wrongCodeResult = await callController(authController.register, {
      user: {},
      body: {
        username: 'verified_user',
        email: '123456@qq.com',
        password: 'secret123',
        code: '000000'
      }
    });
    expectStatus(wrongCodeResult, 400, 'reject wrong registration code');
    assert.equal(await User.countDocuments({ email: '123456@qq.com' }), 0, 'wrong code should not create a user');

    const registerResult = await callController(authController.register, {
      user: {},
      body: {
        username: 'verified_user',
        email: '123456@qq.com',
        password: 'secret123',
        code: capturedCode
      }
    });
    expectStatus(registerResult, 201, 'register with verified email code');
    assert.ok(!registerResult.body.token, 'registration under review should not return auth token');
    assert.equal(registerResult.body.user.email, '123456@qq.com');
    assert.ok(registerResult.body.user.email_verified_at, 'registered user email should be verified');
    assert.equal(registerResult.body.user.registration_status, 'pending');
    assert.ok(registerResult.body.user.uid, 'registered user should receive generated UID');

    const user = await User.findOne({ email: '123456@qq.com' }).lean();
    assert.ok(user, 'verified registration should create user');
    assert.equal(user.username, 'verified_user');
    assert.equal(user.qq, '123456', 'QQ number should be inferred from qq.com email');
    assert.ok(user.email_verified_at, 'created user should have verified email timestamp');
    assert.equal(user.registration_status, 'pending', 'created user should wait for review');
    assert.ok(user.uid, 'created user should have UID');
    assert.equal(await RegistrationVerification.countDocuments({ email: '123456@qq.com' }), 0, 'used registration code should be deleted');

    const registrationApplication = await Application.findOne({
      user_id: user._id,
      type: 'registration',
      status: 'pending'
    }).lean();
    assert.ok(registrationApplication, 'pending registration application should be created');

    const pendingLogin = await callController(authController.login, {
      user: {},
      body: { username: 'verified_user', password: 'secret123' }
    });
    expectStatus(pendingLogin, 403, 'pending registration cannot login');

    const admin = await createUser({ username: 'registration_admin', roles: ['user', 'admin'] });
    const approveResult = await callController(adminApplicationController.decideApplication, {
      user: admin,
      params: { id: objectId(registrationApplication) },
      body: { status: 'approved', remark: 'ok' }
    });
    expectStatus(approveResult, 200, 'approve registration');
    assert.equal(approvedEmail, '123456@qq.com', 'approval email should be sent');

    const approvedUser = await User.findById(user._id).lean();
    assert.equal(approvedUser.registration_status, 'approved', 'approved registration should activate user');

    const approvedLogin = await callController(authController.login, {
      user: {},
      body: { username: 'verified_user', password: 'secret123' }
    });
    expectStatus(approvedLogin, 200, 'approved registration can login');
    assert.ok(approvedLogin.body.token, 'approved login should return auth token');

    const duplicateEmailResult = await callController(authController.sendRegisterCode, {
      user: {},
      body: { email: '123456@qq.com', username: 'another_user' }
    });
    expectStatus(duplicateEmailResult, 409, 'block registration code for existing email');

    capturedCode = null;
    const rejectCodeResult = await callController(authController.sendRegisterCode, {
      user: {},
      body: { email: '654321@qq.com', username: 'rejected_user' }
    });
    expectStatus(rejectCodeResult, 200, 'send code for rejected path');
    const rejectRegisterResult = await callController(authController.register, {
      user: {},
      body: {
        username: 'rejected_user',
        email: '654321@qq.com',
        password: 'secret123',
        code: capturedCode
      }
    });
    expectStatus(rejectRegisterResult, 201, 'submit registration for rejection');
    const rejectedUser = await User.findOne({ email: '654321@qq.com' }).lean();
    const rejectApplication = await Application.findOne({
      user_id: rejectedUser._id,
      type: 'registration',
      status: 'pending'
    }).lean();
    const rejectResult = await callController(adminApplicationController.decideApplication, {
      user: admin,
      params: { id: objectId(rejectApplication) },
      body: { status: 'rejected', remark: 'QQ 信息无法核验' }
    });
    expectStatus(rejectResult, 200, 'reject registration');
    assert.equal(rejectedEmail, '654321@qq.com', 'rejection email should be sent');
    assert.equal(rejectedReason, 'QQ 信息无法核验', 'rejection email should include custom reason');

    const rejectedLogin = await callController(authController.login, {
      user: {},
      body: { username: 'rejected_user', password: 'secret123' }
    });
    expectStatus(rejectedLogin, 403, 'rejected registration cannot login');
  } finally {
    emailService.sendRegistrationCodeEmail = originalSendRegistrationCodeEmail;
    emailService.sendRegistrationApprovedEmail = originalSendRegistrationApprovedEmail;
    emailService.sendRegistrationRejectedEmail = originalSendRegistrationRejectedEmail;
  }
}

async function testTransferAndBuyback() {
  await resetDatabase();

  const admin = await createUser({ username: 'admin', roles: ['user', 'admin'] });
  const fromUser = await createUser({
    username: 'transfer_from',
    qq: '10001',
    vip_level: 2,
    transfer_remaining: 1,
    buyback_remaining: 1,
    roles: ['user', 'vip']
  });
  const toUser = await createUser({ username: 'transfer_to', qq: '10002' });
  const item = await Item.create({
    sku_code: 'VERIFY-TRANSFER',
    name: 'Verification Transfer Item',
    artist: 'Verifier',
    topics: ['CG'],
    price: 300,
    delivery_link: 'https://example.invalid/delivery',
    status: 'on_sale'
  });
  const originalOwnership = await Ownership.create({
    user_id: fromUser._id,
    item_id: item._id,
    acquisition_type: 'self',
    points_delta: item.price,
    occurred_at: new Date('2026-01-01T00:00:00.000Z'),
    delivery_link: item.delivery_link,
    active: true
  });

  const transferResult = await callController(assetController.transferAsset, {
    user: fromUser,
    body: { ownership_id: objectId(originalOwnership), target_id: objectId(toUser) }
  });
  expectStatus(transferResult, 200, 'transfer asset');

  const originalAfterTransfer = await Ownership.findById(originalOwnership._id).lean();
  assert.equal(originalAfterTransfer.active, false, 'original self ownership should be inactive');

  const transferOut = await Ownership.findOne({
    user_id: fromUser._id,
    item_id: item._id,
    acquisition_type: 'transfer_out'
  }).lean();
  assert.ok(transferOut, 'transfer_out ownership should exist');
  assert.equal(transferOut.active, true, 'transfer_out ownership should stay active until buyback closes it');
  assert.equal(objectId(transferOut.target_user_id), objectId(toUser), 'transfer_out should point to receiver');
  assert.ok(transferOut.replaced_by, 'transfer_out should point to receiver ownership via replaced_by');

  const receiverOwnership = await Ownership.findOne({
    user_id: toUser._id,
    item_id: item._id,
    acquisition_type: 'self'
  }).lean();
  assert.ok(receiverOwnership, 'receiver self ownership should exist');
  assert.equal(receiverOwnership.active, true, 'receiver self ownership should be active');
  assert.equal(receiverOwnership.delivery_link, item.delivery_link, 'receiver should receive delivery link');
  assert.equal(objectId(transferOut.replaced_by), objectId(receiverOwnership), 'transfer_out should reference receiver record');

  const transferTransactions = await Transaction.find({ item_id: item._id }).lean();
  assert.equal(transferTransactions.length, 2, 'transfer should create two transactions');
  assert.ok(transferTransactions.some(t => t.type === 'transfer_out'), 'transfer_out transaction should exist');
  assert.ok(transferTransactions.some(t => t.type === 'transfer_in'), 'transfer_in transaction should exist');

  const fromAfterTransfer = await User.findById(fromUser._id).lean();
  assert.equal(fromAfterTransfer.transfer_remaining, 0, 'transfer should consume one transfer quota');

  const hiddenAssetsResult = await callController(assetController.getMyAssets, {
    user: fromUser,
    query: {}
  });
  expectStatus(hiddenAssetsResult, 200, 'get assets after transfer');
  assert.equal(hiddenAssetsResult.body.total, 0, 'default asset view should hide transfer_out records');

  const buybackResult = await callController(applicationController.submitBuyback, {
    user: fromUser,
    body: { ownership_id: objectId(transferOut), reason: 'verify buyback' }
  });
  expectStatus(buybackResult, 200, 'submit buyback');

  const duplicateBuybackResult = await callController(applicationController.submitBuyback, {
    user: fromUser,
    body: { ownership_id: objectId(transferOut), reason: 'duplicate verify buyback' }
  });
  expectStatus(duplicateBuybackResult, 400, 'block duplicate pending buyback');

  const application = await Application.findOne({
    user_id: fromUser._id,
    type: 'buyback',
    status: 'pending'
  }).lean();
  assert.ok(application, 'pending buyback application should exist');

  const approveResult = await callController(adminApplicationController.decideApplication, {
    user: admin,
    params: { id: objectId(application) },
    body: { status: 'approved', remark: 'verified' }
  });
  expectStatus(approveResult, 200, 'approve buyback');

  const approvedApplication = await Application.findById(application._id).lean();
  assert.equal(approvedApplication.status, 'approved', 'application should be approved after successful buyback');

  const transferOutAfterBuyback = await Ownership.findById(transferOut._id).lean();
  assert.equal(transferOutAfterBuyback.active, false, 'buyback should close original transfer_out');
  assert.notEqual(
    objectId(transferOutAfterBuyback.replaced_by),
    objectId(receiverOwnership),
    'closed transfer_out should reference the recovered owner record'
  );

  const receiverAfterBuyback = await Ownership.findById(receiverOwnership._id).lean();
  assert.equal(receiverAfterBuyback.active, false, 'buyback should deactivate receiver ownership');

  const recoveredOwnership = await Ownership.findById(transferOutAfterBuyback.replaced_by).lean();
  assert.ok(recoveredOwnership, 'buyback should create recovered ownership');
  assert.equal(objectId(recoveredOwnership.user_id), objectId(fromUser), 'recovered ownership should belong to applicant');
  assert.equal(recoveredOwnership.acquisition_type, 'self', 'recovered ownership should use self type');
  assert.equal(recoveredOwnership.transfer_locked, true, 'buyback ownership should be transfer locked');
  assert.equal(recoveredOwnership.active, true, 'recovered ownership should be active');

  const fromAfterBuyback = await User.findById(fromUser._id).lean();
  assert.equal(fromAfterBuyback.buyback_remaining, 0, 'buyback should consume one buyback quota');

  await User.findByIdAndUpdate(fromUser._id, { buyback_remaining: 1 });
  const postApprovalBuybackResult = await callController(applicationController.submitBuyback, {
    user: fromUser,
    body: { ownership_id: objectId(transferOut), reason: 'after approval' }
  });
  expectStatus(postApprovalBuybackResult, 404, 'closed transfer_out cannot be submitted for buyback again');

  const buybackTransactions = await Transaction.find({
    item_id: item._id,
    'metadata.buyback': true
  }).lean();
  assert.equal(buybackTransactions.length, 2, 'approved buyback should create two buyback transactions');
}

async function testVipImportAndYearlyWorkflows() {
  await resetDatabase();

  const admin = await createUser({ username: 'vip_admin', roles: ['user', 'admin'] });

  const importResult = await callController(adminVipController.importVips, {
    user: admin,
    body: {
      vips: [
        {
          email: 'vip-import@example.invalid',
          qq: '88880001',
          vip_level: 3,
          points: 6000,
          annual_spend: 120,
          platform: '易次元',
          platform_id: 'vip-import-platform'
        },
        {
          qq: '88880002',
          vip_level: 99,
          points: 99000
        }
      ]
    }
  });
  expectStatus(importResult, 200, 'import VIP payload');
  assert.equal(importResult.body.success, 1, 'VIP import should report one success');
  assert.equal(importResult.body.failed, 1, 'VIP import should report one failure');
  assert.equal(importResult.body.errors.length, 1, 'VIP import should include failure details');

  const importedUser = await User.findOne({ qq: '88880001' }).lean();
  assert.ok(importedUser, 'VIP import should create user');
  assert.equal(importedUser.email, 'vip-import@example.invalid');
  assert.equal(importedUser.vip_level, 3);
  assert.equal(importedUser.points_total, 6000);
  assert.equal(importedUser.annual_spend, 120);
  assert.equal(importedUser.platform, '易次元');
  assert.equal(importedUser.platform_id, 'vip-import-platform');
  assert.equal(importedUser.transfer_remaining, 2);
  assert.equal(importedUser.buyback_remaining, 2);
  assert.deepEqual(importedUser.roles.includes('vip'), true, 'imported VIP should have vip role');

  const vipSearchResult = await callController(adminVipController.getVipCustomers, {
    user: admin,
    query: { q: '88880001' }
  });
  expectStatus(vipSearchResult, 200, 'VIP customer keyword search');
  assert.equal(vipSearchResult.body.total, 1, 'VIP customer search should find imported user');

  await User.findByIdAndUpdate(importedUser._id, {
    transfer_remaining: 0,
    buyback_remaining: 0,
    skip_queue_remaining: 9
  });
  const resetCountersResult = await callController(adminVipController.resetCounters, {
    user: admin,
    body: { vip_level: 3 }
  });
  expectStatus(resetCountersResult, 200, 'reset VIP counters');
  const countersAfterReset = await User.findById(importedUser._id).lean();
  assert.equal(countersAfterReset.transfer_remaining, 2, 'counter reset should restore transfer quota');
  assert.equal(countersAfterReset.buyback_remaining, 2, 'counter reset should restore buyback quota');
  assert.equal(countersAfterReset.skip_queue_remaining, 0, 'counter reset should restore skip queue quota');

  const blockedDowngradeResult = await callController(adminVipController.updateVipCustomer, {
    user: admin,
    params: { id: objectId(importedUser) },
    body: { vip_level: 2 }
  });
  expectStatus(blockedDowngradeResult, 400, 'manual downgrade should require zero annual spend');

  await User.findByIdAndUpdate(importedUser._id, { annual_spend: 0 });
  const downgradeResult = await callController(adminVipController.updateVipCustomer, {
    user: admin,
    params: { id: objectId(importedUser) },
    body: { vip_level: 2 }
  });
  expectStatus(downgradeResult, 200, 'manual downgrade with zero annual spend');
  const downgradedUser = await User.findById(importedUser._id).lean();
  assert.equal(downgradedUser.vip_level, 2);
  assert.equal(downgradedUser.transfer_remaining, 1);
  assert.equal(downgradedUser.buyback_remaining, 1);
  assert.equal(downgradedUser.roles.includes('vip'), true);

  const positiveSpendUser = await createUser({
    username: 'positive_spend_vip',
    qq: '77770001',
    vip_level: 5,
    points_total: 20000,
    annual_spend: 100,
    transfer_remaining: 6,
    buyback_remaining: 3,
    skip_queue_remaining: 6,
    roles: ['user', 'vip']
  });
  const zeroSpendUser = await createUser({
    username: 'zero_spend_vip',
    qq: '77770002',
    vip_level: 4,
    points_total: 10000,
    annual_spend: 0,
    transfer_remaining: 3,
    buyback_remaining: 2,
    skip_queue_remaining: 3,
    roles: ['user', 'vip']
  });

  const annualResetResult = await callController(adminVipController.resetAnnualSpend, {
    user: admin,
    body: {}
  });
  expectStatus(annualResetResult, 200, 'reset annual spend');
  assert.equal(annualResetResult.body.downgraded, 0, 'annual spend reset should not auto-downgrade users');

  const positiveSpendAfterReset = await User.findById(positiveSpendUser._id).lean();
  assert.equal(positiveSpendAfterReset.annual_spend, 0, 'annual reset should clear positive annual spend');
  assert.equal(positiveSpendAfterReset.vip_level, 5, 'annual reset should preserve VIP level for manual review');
  assert.equal(positiveSpendAfterReset.roles.includes('vip'), true, 'annual reset should preserve vip role');

  const zeroSpendAfterReset = await User.findById(zeroSpendUser._id).lean();
  assert.equal(zeroSpendAfterReset.annual_spend, 0, 'annual reset should keep zero annual spend at zero');
  assert.equal(zeroSpendAfterReset.vip_level, 4, 'annual reset should not perform the manual downgrade step');
  assert.equal(zeroSpendAfterReset.roles.includes('vip'), true, 'annual reset should preserve vip role');

  const removeVipResult = await callController(adminVipController.updateVipCustomer, {
    user: admin,
    params: { id: objectId(zeroSpendUser) },
    body: { vip_level: 0 }
  });
  expectStatus(removeVipResult, 200, 'manual downgrade to regular user');
  const regularUser = await User.findById(zeroSpendUser._id).lean();
  assert.equal(regularUser.vip_level, 0);
  assert.equal(regularUser.transfer_remaining, 0);
  assert.equal(regularUser.buyback_remaining, 0);
  assert.equal(regularUser.skip_queue_remaining, 0);
  assert.equal(regularUser.roles.includes('vip'), false, 'manual downgrade to 0 should remove vip role');
}

async function connect() {
  const externalUri = process.env.VERIFY_MONGODB_URI;
  if (externalUri) {
    await mongoose.connect(externalUri);
    return;
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(replSet.getUri('shiyuan_core_verify'));
}

async function disconnect() {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
}

async function main() {
  await connect();
  try {
    await testVerifiedEmailRegistration();
    console.log('OK verified email registration workflow');
    await testTransferAndBuyback();
    console.log('OK transfer and buyback workflows');
    await testVipImportAndYearlyWorkflows();
    console.log('OK VIP import and yearly workflows');
    console.log('Core flow verification completed');
  } finally {
    await disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await disconnect();
  process.exit(1);
});
