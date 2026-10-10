const jwt = require('jsonwebtoken');

describe('Authentication & JWT Verification', () => {
  const JWT_SECRET = 'supersecret_boardcollab_jwt_key_2026';

  test('should generate and verify user token with required claims', () => {
    const payload = {
      id: 'user_123',
      username: 'Alice',
      color: '#3B82F6'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    expect(token).toBeDefined();

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe('user_123');
    expect(decoded.username).toBe('Alice');
    expect(decoded.color).toBe('#3B82F6');
  });

  test('should support guest sessions with isGuest flag', () => {
    const guestPayload = {
      id: 'guest_999',
      username: 'Guest_999',
      color: '#10B981',
      isGuest: true
    };

    const token = jwt.sign(guestPayload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET);

    expect(decoded.isGuest).toBe(true);
    expect(decoded.username).toContain('Guest');
  });

  test('should reject invalid or tampered tokens', () => {
    expect(() => {
      jwt.verify('invalid.token.signature', JWT_SECRET);
    }).toThrow();
  });
});
