import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:8080/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function run() {
  console.log('================================================================');
  console.log('STARTING TEST: AUTH EXTRA RELEASE GATE');
  console.log('================================================================\n');

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `auth_extra_${suffix}@phanbonshop.vn`;
  const originalPassword = 'Customer@123456';
  const changedPassword = 'Customer@654321';

  const register = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: originalPassword,
      fullName: 'Auth Extra Release Gate',
      phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    }),
  });
  assert.ok(register.res.ok, `register phải thành công: ${JSON.stringify(register.data)}`);
  const accessToken = register.data.data?.accessToken || register.data.accessToken;
  const refreshToken = register.data.data?.refreshToken || register.data.refreshToken;
  assert.ok(accessToken && refreshToken, 'register phải trả accessToken và refreshToken');
  console.log('✔ register returns access/refresh tokens');

  const logout = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  assert.ok(logout.res.ok, `logout phải thành công: ${JSON.stringify(logout.data)}`);

  const refreshAfterLogout = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  assert.strictEqual(refreshAfterLogout.res.status, 401, 'refresh token đã logout phải bị revoke');
  console.log('✔ logout revokes current refresh token');

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: originalPassword }),
  });
  assert.ok(login.res.ok, `login lại phải thành công: ${JSON.stringify(login.data)}`);
  const newAccessToken = login.data.data?.accessToken || login.data.accessToken;
  const newRefreshToken = login.data.data?.refreshToken || login.data.refreshToken;

  const changePassword = await request('/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${newAccessToken}` },
    body: JSON.stringify({
      oldPassword: originalPassword,
      newPassword: changedPassword,
    }),
  });
  assert.ok(changePassword.res.ok, `change password phải thành công: ${JSON.stringify(changePassword.data)}`);
  console.log('✔ change password succeeds');

  const oldLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: originalPassword }),
  });
  assert.strictEqual(oldLogin.res.status, 401, 'mật khẩu cũ phải bị từ chối sau change password');

  const changedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: changedPassword }),
  });
  assert.ok(changedLogin.res.ok, `mật khẩu mới phải login được: ${JSON.stringify(changedLogin.data)}`);

  const refreshAfterChange = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: newRefreshToken }),
  });
  assert.strictEqual(refreshAfterChange.res.status, 401, 'refresh token cũ phải bị revoke sau change password');
  console.log('✔ old password rejected, new password accepted, old refresh revoked');

  console.log('\nALL AUTH EXTRA RELEASE GATE TESTS PASSED!');
}

run().catch((err) => {
  console.error('\nAUTH EXTRA RELEASE GATE TEST FAILED:', err);
  process.exit(1);
});
