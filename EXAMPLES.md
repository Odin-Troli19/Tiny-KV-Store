# 💡 Tiny KV Store Pro - Examples & Use Cases

Comprehensive guide with real-world examples and practical use cases.

## Table of Contents

- [User Management](#user-management)
- [Session Management](#session-management)
- [Caching Strategies](#caching-strategies)
- [Rate Limiting](#rate-limiting)
- [Configuration Management](#configuration-management)
- [Shopping Cart](#shopping-cart)
- [Task Queue](#task-queue)
- [Analytics & Metrics](#analytics--metrics)
- [Feature Flags](#feature-flags)
- [Notifications](#notifications)

---

## User Management

### Basic User CRUD

```javascript
class UserManager {
  constructor(store) {
    this.store = store;
    this.prefix = 'user:';
  }

  // Create user
  createUser(userId, userData) {
    const key = this.prefix + userId;
    const value = JSON.stringify({
      ...userData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return this.store.put(key, value);
  }

  // Get user
  getUser(userId) {
    const key = this.prefix + userId;
    const data = this.store.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Update user
  updateUser(userId, updates) {
    const user = this.getUser(userId);
    if (!user) return null;
    
    const updated = {
      ...user,
      ...updates,
      updatedAt: Date.now()
    };
    
    return this.store.put(
      this.prefix + userId,
      JSON.stringify(updated)
    );
  }

  // Delete user
  deleteUser(userId) {
    return this.store.delete(this.prefix + userId);
  }

  // List all users
  listUsers() {
    const keys = this.store.prefixSearch(this.prefix);
    return keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);
  }

  // Search users by role
  getUsersByRole(role) {
    return this.listUsers().filter(user => user.role === role);
  }

  // Count users
  countUsers() {
    return this.store.prefixSearch(this.prefix).length;
  }
}

// Usage
const userMgr = new UserManager(kvStore);

userMgr.createUser('001', {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  role: 'admin'
});

const user = userMgr.getUser('001');
console.log(user);

userMgr.updateUser('001', { lastLogin: Date.now() });

const admins = userMgr.getUsersByRole('admin');
console.log('Admins:', admins);
```

---

## Session Management

### Session Store

```javascript
class SessionManager {
  constructor(store) {
    this.store = store;
    this.prefix = 'session:';
    this.defaultTTL = 3600; // 1 hour
  }

  // Create session
  createSession(userId, ttl = this.defaultTTL) {
    const sessionId = this.generateSessionId();
    const key = this.prefix + sessionId;
    
    const sessionData = {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000)
    };
    
    this.store.put(key, JSON.stringify(sessionData), { ttl });
    return sessionId;
  }

  // Get session
  getSession(sessionId) {
    const key = this.prefix + sessionId;
    const data = this.store.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Validate session
  isValidSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    return session.expiresAt > Date.now();
  }

  // Renew session
  renewSession(sessionId, ttl = this.defaultTTL) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    
    session.expiresAt = Date.now() + (ttl * 1000);
    this.store.put(
      this.prefix + sessionId,
      JSON.stringify(session),
      { ttl }
    );
    return true;
  }

  // Destroy session
  destroySession(sessionId) {
    return this.store.delete(this.prefix + sessionId);
  }

  // Get user sessions
  getUserSessions(userId) {
    const keys = this.store.prefixSearch(this.prefix);
    return keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(s => s && s.userId === userId);
  }

  // Destroy all user sessions
  destroyAllUserSessions(userId) {
    const sessions = this.getUserSessions(userId);
    sessions.forEach(session => {
      const sessionId = session.sessionId;
      this.destroySession(sessionId);
    });
  }

  // Generate session ID
  generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 16) + 
           Date.now().toString(36);
  }

  // List active sessions
  getActiveSessions() {
    const keys = this.store.prefixSearch(this.prefix);
    return keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);
  }

  // Session analytics
  getSessionStats() {
    const sessions = this.getActiveSessions();
    return {
      total: sessions.length,
      byUser: this.countByUser(sessions),
      avgDuration: this.avgSessionDuration(sessions)
    };
  }

  countByUser(sessions) {
    return sessions.reduce((acc, session) => {
      acc[session.userId] = (acc[session.userId] || 0) + 1;
      return acc;
    }, {});
  }

  avgSessionDuration(sessions) {
    const durations = sessions.map(s => 
      Date.now() - s.createdAt
    );
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }
}

// Usage
const sessionMgr = new SessionManager(kvStore);

// Login
const sessionId = sessionMgr.createSession('user:001', 3600);
console.log('Session created:', sessionId);

// Validate on each request
if (sessionMgr.isValidSession(sessionId)) {
  console.log('Valid session');
  sessionMgr.renewSession(sessionId); // Extend
}

// Logout
sessionMgr.destroySession(sessionId);
```

---

## Caching Strategies

### API Response Cache

```javascript
class APICache {
  constructor(store) {
    this.store = store;
    this.prefix = 'cache:api:';
    this.defaultTTL = 300; // 5 minutes
  }

  // Cache key generator
  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return this.prefix + endpoint + (paramStr ? ':' + paramStr : '');
  }

  // Get from cache
  get(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);
    const data = this.store.get(key);
    
    if (data) {
      const parsed = JSON.parse(data);
      console.log('Cache HIT:', endpoint);
      return parsed.response;
    }
    
    console.log('Cache MISS:', endpoint);
    return null;
  }

  // Set cache
  set(endpoint, params = {}, response, ttl = this.defaultTTL) {
    const key = this.generateKey(endpoint, params);
    const value = JSON.stringify({
      response,
      cachedAt: Date.now()
    });
    return this.store.put(key, value, { ttl });
  }

  // Cached fetch
  async cachedFetch(url, options = {}, ttl = this.defaultTTL) {
    const cached = this.get(url, options);
    if (cached) return cached;
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    this.set(url, options, data, ttl);
    return data;
  }

  // Invalidate cache
  invalidate(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);
    return this.store.delete(key);
  }

  // Invalidate pattern
  invalidatePattern(pattern) {
    const keys = this.store.prefixSearch(this.prefix + pattern);
    keys.forEach(key => this.store.delete(key));
  }

  // Clear all cache
  clear() {
    const keys = this.store.prefixSearch(this.prefix);
    keys.forEach(key => this.store.delete(key));
  }

  // Cache statistics
  getStats() {
    const keys = this.store.prefixSearch(this.prefix);
    const entries = keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);

    return {
      total: entries.length,
      oldestCached: Math.min(...entries.map(e => e.cachedAt)),
      newestCached: Math.max(...entries.map(e => e.cachedAt)),
      avgAge: (Date.now() - 
        entries.reduce((sum, e) => sum + e.cachedAt, 0) / entries.length) / 1000
    };
  }
}

// Usage
const apiCache = new APICache(kvStore);

// Fetch with caching
async function getUsers() {
  const data = await apiCache.cachedFetch(
    '/api/users',
    {},
    300 // 5 minutes
  );
  return data;
}

// Invalidate on update
async function updateUser(userId, updates) {
  await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  
  // Invalidate related caches
  apiCache.invalidate('/api/users');
  apiCache.invalidate(`/api/users/${userId}`);
}

// Periodic cache cleanup
setInterval(() => {
  const stats = apiCache.getStats();
  if (stats.avgAge > 3600) { // 1 hour
    apiCache.clear();
  }
}, 60000);
```

---

## Rate Limiting

### Rate Limiter

```javascript
class RateLimiter {
  constructor(store) {
    this.store = store;
    this.prefix = 'ratelimit:';
  }

  // Check rate limit
  checkLimit(key, limit, windowSeconds = 60) {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const storageKey = this.prefix + key;
    
    // Get existing requests
    let data = this.store.get(storageKey);
    let requests = data ? JSON.parse(data) : [];
    
    // Remove old requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check limit
    if (requests.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: requests[0] + (windowSeconds * 1000)
      };
    }
    
    // Add new request
    requests.push(now);
    this.store.put(storageKey, JSON.stringify(requests), { ttl: windowSeconds });
    
    return {
      allowed: true,
      remaining: limit - requests.length,
      resetAt: now + (windowSeconds * 1000)
    };
  }

  // Different rate limit strategies

  // Per user
  checkUserLimit(userId, limit = 100, window = 60) {
    return this.checkLimit(`user:${userId}`, limit, window);
  }

  // Per IP
  checkIPLimit(ip, limit = 1000, window = 60) {
    return this.checkLimit(`ip:${ip}`, limit, window);
  }

  // Per endpoint
  checkEndpointLimit(endpoint, limit = 10, window = 1) {
    return this.checkLimit(`endpoint:${endpoint}`, limit, window);
  }

  // Combined rate limit
  checkCombinedLimit(userId, ip, endpoint) {
    const userCheck = this.checkUserLimit(userId, 100, 3600);
    if (!userCheck.allowed) return userCheck;
    
    const ipCheck = this.checkIPLimit(ip, 1000, 3600);
    if (!ipCheck.allowed) return ipCheck;
    
    const endpointCheck = this.checkEndpointLimit(endpoint, 10, 60);
    return endpointCheck;
  }

  // Reset limit
  reset(key) {
    return this.store.delete(this.prefix + key);
  }

  // Get current usage
  getUsage(key) {
    const storageKey = this.prefix + key;
    const data = this.store.get(storageKey);
    return data ? JSON.parse(data).length : 0;
  }
}

// Usage
const rateLimiter = new RateLimiter(kvStore);

// API endpoint middleware
function rateLimitMiddleware(req, res, next) {
  const userId = req.user.id;
  const endpoint = req.path;
  
  const result = rateLimiter.checkEndpointLimit(endpoint);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetAt: new Date(result.resetAt).toISOString()
    });
  }
  
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt);
  next();
}

// Usage in application
async function apiRequest(endpoint) {
  const result = rateLimiter.checkUserLimit('user:001', 100, 3600);
  
  if (!result.allowed) {
    const waitTime = result.resetAt - Date.now();
    throw new Error(`Rate limited. Wait ${waitTime}ms`);
  }
  
  console.log(`Remaining: ${result.remaining}`);
  return fetch(endpoint);
}
```

---

## Configuration Management

### Config Store

```javascript
class ConfigManager {
  constructor(store) {
    this.store = store;
    this.prefix = 'config:';
  }

  // Get config
  get(key, defaultValue = null) {
    const fullKey = this.prefix + key;
    const value = this.store.get(fullKey);
    return value !== null ? JSON.parse(value) : defaultValue;
  }

  // Set config
  set(key, value) {
    const fullKey = this.prefix + key;
    return this.store.put(fullKey, JSON.stringify(value));
  }

  // Get namespace
  getNamespace(namespace) {
    const prefix = this.prefix + namespace + ':';
    const keys = this.store.prefixSearch(prefix);
    
    const config = {};
    keys.forEach(key => {
      const shortKey = key.replace(prefix, '');
      const value = this.store.get(key);
      config[shortKey] = JSON.parse(value);
    });
    
    return config;
  }

  // Set namespace
  setNamespace(namespace, config) {
    Object.entries(config).forEach(([key, value]) => {
      this.set(`${namespace}:${key}`, value);
    });
  }

  // Environment-specific config
  getEnvConfig(env = 'production') {
    return this.getNamespace(env);
  }

  // Typed getters
  getString(key, defaultValue = '') {
    return this.get(key, defaultValue);
  }

  getNumber(key, defaultValue = 0) {
    return Number(this.get(key, defaultValue));
  }

  getBoolean(key, defaultValue = false) {
    return Boolean(this.get(key, defaultValue));
  }

  getArray(key, defaultValue = []) {
    return this.get(key, defaultValue);
  }

  // Feature flags
  isFeatureEnabled(feature) {
    return this.getBoolean(`features:${feature}`, false);
  }

  enableFeature(feature) {
    return this.set(`features:${feature}`, true);
  }

  disableFeature(feature) {
    return this.set(`features:${feature}`, false);
  }

  // Secrets (encrypted)
  setSecret(key, value) {
    const fullKey = this.prefix + 'secret:' + key;
    return this.store.putEncrypted(fullKey, value);
  }

  getSecret(key) {
    const fullKey = this.prefix + 'secret:' + key;
    return this.store.getDecrypted(fullKey);
  }
}

// Usage
const config = new ConfigManager(kvStore);

// Basic config
config.set('app:name', 'My App');
config.set('app:version', '1.0.0');
config.set('app:debug', true);

// Get config
const appName = config.getString('app:name');
const debug = config.getBoolean('app:debug');

// Environment config
config.setNamespace('production', {
  apiUrl: 'https://api.example.com',
  dbHost: 'db.example.com',
  cacheEnabled: true
});

const prodConfig = config.getEnvConfig('production');

// Feature flags
config.enableFeature('dark-mode');
config.enableFeature('beta-features');

if (config.isFeatureEnabled('dark-mode')) {
  enableDarkMode();
}

// Secrets
config.setSecret('apiKey', 'sk-proj-abc123');
config.setSecret('dbPassword', 'securePass123');

const apiKey = config.getSecret('apiKey');
```

---

## Shopping Cart

### Cart Manager

```javascript
class CartManager {
  constructor(store) {
    this.store = store;
    this.prefix = 'cart:';
    this.ttl = 86400; // 24 hours
  }

  // Get cart
  getCart(userId) {
    const key = this.prefix + userId;
    const data = this.store.get(key);
    return data ? JSON.parse(data) : { items: [], total: 0 };
  }

  // Add item
  addItem(userId, product) {
    const cart = this.getCart(userId);
    
    const existingIndex = cart.items.findIndex(
      item => item.id === product.id
    );
    
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += product.quantity || 1;
    } else {
      cart.items.push({
        ...product,
        quantity: product.quantity || 1,
        addedAt: Date.now()
      });
    }
    
    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = Date.now();
    
    this.saveCart(userId, cart);
    return cart;
  }

  // Remove item
  removeItem(userId, productId) {
    const cart = this.getCart(userId);
    cart.items = cart.items.filter(item => item.id !== productId);
    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = Date.now();
    
    this.saveCart(userId, cart);
    return cart;
  }

  // Update quantity
  updateQuantity(userId, productId, quantity) {
    const cart = this.getCart(userId);
    const item = cart.items.find(item => item.id === productId);
    
    if (item) {
      item.quantity = quantity;
      if (quantity <= 0) {
        return this.removeItem(userId, productId);
      }
    }
    
    cart.total = this.calculateTotal(cart.items);
    cart.updatedAt = Date.now();
    
    this.saveCart(userId, cart);
    return cart;
  }

  // Clear cart
  clearCart(userId) {
    return this.store.delete(this.prefix + userId);
  }

  // Calculate total
  calculateTotal(items) {
    return items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );
  }

  // Save cart
  saveCart(userId, cart) {
    const key = this.prefix + userId;
    return this.store.put(key, JSON.stringify(cart), { ttl: this.ttl });
  }

  // Get item count
  getItemCount(userId) {
    const cart = this.getCart(userId);
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Apply coupon
  applyCoupon(userId, couponCode) {
    const cart = this.getCart(userId);
    
    // Validate coupon (simplified)
    const discount = this.validateCoupon(couponCode);
    if (discount) {
      cart.coupon = couponCode;
      cart.discount = discount;
      cart.finalTotal = cart.total * (1 - discount);
    }
    
    this.saveCart(userId, cart);
    return cart;
  }

  // Checkout
  checkout(userId) {
    const cart = this.getCart(userId);
    
    // Create order
    const order = {
      orderId: 'order_' + Date.now(),
      userId,
      items: cart.items,
      total: cart.finalTotal || cart.total,
      createdAt: Date.now()
    };
    
    // Save order
    this.store.put(
      `order:${order.orderId}`,
      JSON.stringify(order)
    );
    
    // Clear cart
    this.clearCart(userId);
    
    return order;
  }

  validateCoupon(code) {
    // Simplified coupon validation
    const coupons = {
      'SAVE10': 0.10,
      'SAVE20': 0.20,
      'SAVE50': 0.50
    };
    return coupons[code] || 0;
  }
}

// Usage
const cartMgr = new CartManager(kvStore);

// Add items to cart
cartMgr.addItem('user:001', {
  id: 'prod:123',
  name: 'Laptop',
  price: 999.99,
  quantity: 1
});

cartMgr.addItem('user:001', {
  id: 'prod:456',
  name: 'Mouse',
  price: 29.99,
  quantity: 2
});

// Get cart
const cart = cartMgr.getCart('user:001');
console.log('Cart:', cart);
console.log('Total:', cart.total);

// Update quantity
cartMgr.updateQuantity('user:001', 'prod:123', 2);

// Apply coupon
cartMgr.applyCoupon('user:001', 'SAVE10');

// Checkout
const order = cartMgr.checkout('user:001');
console.log('Order created:', order);
```

---

## Task Queue

### Simple Task Queue

```javascript
class TaskQueue {
  constructor(store) {
    this.store = store;
    this.prefix = 'task:';
    this.processing = false;
  }

  // Add task
  enqueue(taskData, priority = 0) {
    const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const task = {
      id: taskId,
      data: taskData,
      priority,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0
    };
    
    this.store.put(
      this.prefix + taskId,
      JSON.stringify(task)
    );
    
    return taskId;
  }

  // Get next task
  dequeue() {
    const tasks = this.getPendingTasks();
    if (tasks.length === 0) return null;
    
    // Sort by priority (higher first), then by created time
    tasks.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
    
    const task = tasks[0];
    
    // Mark as processing
    task.status = 'processing';
    task.startedAt = Date.now();
    this.store.put(
      this.prefix + task.id,
      JSON.stringify(task)
    );
    
    return task;
  }

  // Complete task
  complete(taskId, result = null) {
    const task = this.getTask(taskId);
    if (!task) return false;
    
    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;
    
    this.store.put(
      this.prefix + taskId,
      JSON.stringify(task)
    );
    
    return true;
  }

  // Fail task
  fail(taskId, error) {
    const task = this.getTask(taskId);
    if (!task) return false;
    
    task.attempts++;
    
    if (task.attempts >= 3) {
      task.status = 'failed';
      task.failedAt = Date.now();
      task.error = error;
    } else {
      task.status = 'pending';
      task.error = error;
      task.retryAt = Date.now() + (1000 * Math.pow(2, task.attempts));
    }
    
    this.store.put(
      this.prefix + taskId,
      JSON.stringify(task)
    );
    
    return true;
  }

  // Get task
  getTask(taskId) {
    const data = this.store.get(this.prefix + taskId);
    return data ? JSON.parse(data) : null;
  }

  // Get pending tasks
  getPendingTasks() {
    const keys = this.store.prefixSearch(this.prefix);
    return keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(task => task && task.status === 'pending');
  }

  // Process queue
  async processQueue(processor) {
    if (this.processing) return;
    this.processing = true;
    
    while (true) {
      const task = this.dequeue();
      if (!task) break;
      
      try {
        const result = await processor(task.data);
        this.complete(task.id, result);
      } catch (error) {
        this.fail(task.id, error.message);
      }
    }
    
    this.processing = false;
  }

  // Statistics
  getStats() {
    const keys = this.store.prefixSearch(this.prefix);
    const tasks = keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(Boolean);
    
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  }

  // Clear completed
  clearCompleted() {
    const keys = this.store.prefixSearch(this.prefix);
    keys.forEach(key => {
      const data = this.store.get(key);
      const task = data ? JSON.parse(data) : null;
      if (task && task.status === 'completed') {
        this.store.delete(key);
      }
    });
  }
}

// Usage
const queue = new TaskQueue(kvStore);

// Add tasks
queue.enqueue({ type: 'email', to: 'user@example.com' }, 1);
queue.enqueue({ type: 'notification', message: 'Hello' }, 0);
queue.enqueue({ type: 'report', userId: '001' }, 2);

// Process queue
async function taskProcessor(taskData) {
  console.log('Processing task:', taskData);
  
  switch (taskData.type) {
    case 'email':
      await sendEmail(taskData.to);
      break;
    case 'notification':
      await sendNotification(taskData.message);
      break;
    case 'report':
      await generateReport(taskData.userId);
      break;
  }
  
  return { success: true };
}

// Start processing
queue.processQueue(taskProcessor);

// Check stats
const stats = queue.getStats();
console.log('Queue stats:', stats);

// Periodic cleanup
setInterval(() => {
  queue.clearCompleted();
}, 3600000); // Every hour
```

---

## Analytics & Metrics

### Metrics Collector

```javascript
class MetricsCollector {
  constructor(store) {
    this.store = store;
    this.prefix = 'metrics:';
  }

  // Record metric
  record(name, value, tags = {}) {
    const timestamp = Date.now();
    const key = this.generateKey(name, timestamp);
    
    const metric = {
      name,
      value,
      tags,
      timestamp
    };
    
    this.store.put(key, JSON.stringify(metric), { ttl: 86400 }); // 24h
  }

  // Counter
  increment(name, amount = 1, tags = {}) {
    this.record(name, amount, { ...tags, type: 'counter' });
  }

  // Gauge
  gauge(name, value, tags = {}) {
    this.record(name, value, { ...tags, type: 'gauge' });
  }

  // Histogram
  histogram(name, value, tags = {}) {
    this.record(name, value, { ...tags, type: 'histogram' });
  }

  // Get metrics by name
  getMetrics(name, since = null) {
    const pattern = this.prefix + name + ':';
    const keys = this.store.prefixSearch(pattern);
    
    return keys.map(key => {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    }).filter(metric => {
      return metric && (!since || metric.timestamp >= since);
    });
  }

  // Aggregate metrics
  aggregate(name, aggregator = 'sum', since = null) {
    const metrics = this.getMetrics(name, since);
    const values = metrics.map(m => m.value);
    
    switch (aggregator) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return null;
    }
  }

  // Time series data
  getTimeSeries(name, interval = 60000, since = null) {
    const metrics = this.getMetrics(name, since);
    const buckets = {};
    
    metrics.forEach(metric => {
      const bucket = Math.floor(metric.timestamp / interval) * interval;
      if (!buckets[bucket]) {
        buckets[bucket] = [];
      }
      buckets[bucket].push(metric.value);
    });
    
    return Object.entries(buckets).map(([timestamp, values]) => ({
      timestamp: parseInt(timestamp),
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    }));
  }

  // Generate key
  generateKey(name, timestamp) {
    return `${this.prefix}${name}:${timestamp}`;
  }

  // Report
  generateReport(since = Date.now() - 3600000) {
    // Get all metric names
    const keys = this.store.prefixSearch(this.prefix);
    const names = new Set();
    
    keys.forEach(key => {
      const parts = key.replace(this.prefix, '').split(':');
      names.add(parts[0]);
    });
    
    const report = {};
    names.forEach(name => {
      report[name] = {
        count: this.aggregate(name, 'count', since),
        sum: this.aggregate(name, 'sum', since),
        avg: this.aggregate(name, 'avg', since),
        min: this.aggregate(name, 'min', since),
        max: this.aggregate(name, 'max', since)
      };
    });
    
    return report;
  }
}

// Usage
const metrics = new MetricsCollector(kvStore);

// Record metrics
metrics.increment('page:views');
metrics.increment('api:requests', 1, { endpoint: '/users' });
metrics.gauge('memory:usage', 1024);
metrics.histogram('request:latency', 123);

// Get aggregates
const totalViews = metrics.aggregate('page:views', 'sum');
const avgLatency = metrics.aggregate('request:latency', 'avg');
const maxMemory = metrics.aggregate('memory:usage', 'max');

console.log('Total views:', totalViews);
console.log('Avg latency:', avgLatency, 'ms');
console.log('Max memory:', maxMemory, 'MB');

// Time series
const latencySeries = metrics.getTimeSeries(
  'request:latency',
  60000, // 1 minute buckets
  Date.now() - 3600000 // Last hour
);

console.log('Latency over time:', latencySeries);

// Generate report
const report = metrics.generateReport();
console.log('Metrics report:', report);
```

---

**More examples available in the full documentation!**

These examples demonstrate real-world usage patterns and best practices for building production applications with Tiny KV Store Pro.